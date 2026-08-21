import crypto from "crypto";

export const SESSION_COOKIE_NAME = "loadder_session";

export class AuthError extends Error {
  constructor(message, status = 401, code = "AUTH_FAILED") {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function normalizeMobile(value = "") {
  return String(value).replace(/\s+/g, "");
}

function isValidIranMobile(mobile) {
  return /^09\d{9}$/.test(mobile);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function workspaceNameFor(name) {
  return `${name} — فضای کاری`;
}

export function createAuthService({
  repository,
  otpHashSecret,
  now = () => new Date(),
  otpTtlMs = 2 * 60 * 1000,
  sessionTtlMs = 30 * 24 * 60 * 60 * 1000,
  maxOtpAttempts = 5,
}) {
  if (!otpHashSecret) {
    throw new Error("AUTH_HASH_SECRET is required for OTP hashing.");
  }

  function hashOtp(mobile, code) {
    return crypto
      .createHmac("sha256", otpHashSecret)
      .update(`${mobile}:${code}`)
      .digest("hex");
  }

  function hashSessionToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  function sessionCookieOptions(nodeEnv = "development") {
    return {
      httpOnly: true,
      secure: nodeEnv === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionTtlMs,
    };
  }

  function requestOtp({ mobile: rawMobile, name: rawName }) {
    const mobile = normalizeMobile(rawMobile);
    const name = String(rawName || "").trim();

    if (!isValidIranMobile(mobile)) {
      throw new AuthError("شماره موبایل معتبر نیست.", 400, "INVALID_MOBILE");
    }

    const existingUser = repository.findUserByMobile(mobile);
    if (!existingUser && name.length < 2) {
      throw new AuthError(
        "برای ساخت حساب، نام معتبر وارد کنید.",
        400,
        "NAME_REQUIRED"
      );
    }

    const code = String(crypto.randomInt(10000, 100000));
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + otpTtlMs);

    const challenge = repository.createOtpChallenge({
      mobile,
      name: existingUser?.name || name,
      codeHash: hashOtp(mobile, code),
      expiresAt: expiresAt.toISOString(),
      createdAt: createdAt.toISOString(),
    });

    return { challenge, code };
  }

  function verifyOtp({ mobile: rawMobile, code: rawCode }) {
    const mobile = normalizeMobile(rawMobile);
    const code = String(rawCode || "").trim();

    if (!isValidIranMobile(mobile) || !/^\d{5}$/.test(code)) {
      throw new AuthError("کد تأیید معتبر نیست.", 400, "INVALID_OTP");
    }

    const challenge = repository.findActiveOtpChallenge(mobile);
    const currentTime = now();

    if (!challenge) {
      throw new AuthError("کد تأیید معتبر نیست.", 400, "INVALID_OTP");
    }

    if (new Date(challenge.expires_at) <= currentTime) {
      repository.consumeOtpChallenge(challenge.id, currentTime.toISOString());
      throw new AuthError("کد تأیید معتبر نیست.", 400, "INVALID_OTP");
    }

    if (challenge.attempts >= maxOtpAttempts) {
      repository.consumeOtpChallenge(challenge.id, currentTime.toISOString());
      throw new AuthError("کد تأیید معتبر نیست.", 429, "OTP_ATTEMPTS_EXCEEDED");
    }

    const submittedHash = hashOtp(mobile, code);

    if (!safeEqual(challenge.code_hash, submittedHash)) {
      repository.incrementOtpAttempts(challenge.id);
      throw new AuthError("کد تأیید معتبر نیست.", 400, "INVALID_OTP");
    }

    repository.consumeOtpChallenge(challenge.id, currentTime.toISOString());

    const identity = repository.createUserWorkspaceAndMembership({
      mobile,
      name: challenge.name || `کاربر ${mobile.slice(-4)}`,
      workspaceName: workspaceNameFor(
        challenge.name || `کاربر ${mobile.slice(-4)}`
      ),
      workspaceSlug: `workspace-${mobile.slice(-4)}-${crypto
        .randomBytes(4)
        .toString("hex")}`,
      timestamp: currentTime.toISOString(),
    });

    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const sessionExpiresAt = new Date(
      currentTime.getTime() + sessionTtlMs
    );
    const session = repository.createSession({
      userId: identity.user.id,
      tokenHash: hashSessionToken(sessionToken),
      activeWorkspaceId: identity.memberships[0]?.workspace.id || null,
      expiresAt: sessionExpiresAt.toISOString(),
      timestamp: currentTime.toISOString(),
    });

    repository.createAuditLog({
      workspaceId: identity.memberships[0]?.workspace.id || null,
      userId: identity.user.id,
      action: "auth.login",
      resourceType: "session",
      resourceId: session.id,
      metadata: { method: "otp" },
      createdAt: currentTime.toISOString(),
    });

    return {
      ...identity,
      activeWorkspace: identity.memberships[0]?.workspace || null,
      session,
      sessionToken,
    };
  }

  function resolveSession(token) {
    if (!token) return null;

    const session = repository.findSessionByTokenHash(
      hashSessionToken(token)
    );
    const currentTime = now();

    if (
      !session ||
      session.revoked_at ||
      new Date(session.expires_at) <= currentTime
    ) {
      return null;
    }

    const user = repository.findUserById(session.user_id);
    if (!user || user.status !== "active") return null;

    const memberships = repository.listMemberships(user.id);
    let activeMembership = memberships.find(
      (membership) =>
        membership.workspace.id === session.active_workspace_id
    );

    if (!activeMembership) {
      activeMembership = memberships[0] || null;
      repository.setSessionActiveWorkspace(
        session.id,
        activeMembership?.workspace.id || null,
        currentTime.toISOString()
      );
      session.active_workspace_id = activeMembership?.workspace.id || null;
    } else {
      repository.touchSession(session.id, currentTime.toISOString());
    }

    return {
      session,
      user,
      memberships,
      activeMembership: activeMembership || null,
      activeWorkspace: activeMembership?.workspace || null,
    };
  }

  function revokeSession(token) {
    if (!token) return;
    const identity = resolveSession(token);
    if (identity) {
      const timestamp = now().toISOString();
      repository.createAuditLog({
        workspaceId: identity.activeWorkspace?.id || null,
        userId: identity.user.id,
        action: "auth.logout",
        resourceType: "session",
        resourceId: identity.session.id,
        metadata: {},
        createdAt: timestamp,
      });
      repository.revokeSession(identity.session.id, timestamp);
    }
  }

  function switchWorkspace(identity, workspaceId) {
    const normalizedWorkspaceId = String(workspaceId || "").trim();
    const membership = repository.findMembership(
      identity.user.id,
      normalizedWorkspaceId
    );

    if (!membership) {
      throw new AuthError(
        "Workspace access denied.",
        403,
        "WORKSPACE_ACCESS_DENIED"
      );
    }

    const timestamp = now().toISOString();
    repository.setSessionActiveWorkspace(
      identity.session.id,
      membership.workspace.id,
      timestamp
    );
    repository.createAuditLog({
      workspaceId: membership.workspace.id,
      userId: identity.user.id,
      action: "workspace.switch",
      resourceType: "workspace",
      resourceId: membership.workspace.id,
      metadata: {
        previousWorkspaceId: identity.activeWorkspace?.id || null,
      },
      createdAt: timestamp,
    });

    return resolveSessionById(identity, membership);
  }

  function resolveSessionById(identity, activeMembership) {
    return {
      ...identity,
      session: {
        ...identity.session,
        active_workspace_id: activeMembership.workspace.id,
      },
      activeMembership,
      activeWorkspace: activeMembership.workspace,
    };
  }

  return {
    requestOtp,
    verifyOtp,
    resolveSession,
    revokeSession,
    switchWorkspace,
    sessionCookieOptions,
  };
}
