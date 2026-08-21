export default function ClickTestPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "white",
        padding: "80px",
        fontFamily: "Vazirmatn, sans-serif",
      }}
      dir="rtl"
    >
      <h1
        style={{
          fontSize: "36px",
          marginBottom: "20px",
        }}
      >
        تست کلیک Loadder
      </h1>

      <p
        style={{
          opacity: 0.7,
          marginBottom: "40px",
        }}
      >
        این صفحه هیچ انیمیشن، Overlay یا کامپوننت پیچیده‌ای ندارد.
      </p>

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => {
            alert("دکمه کار می‌کند ✅");
          }}
          style={{
            padding: "18px 28px",
            background: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "14px",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          تست دکمه
        </button>

        <button
          type="button"
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          style={{
            padding: "18px 28px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "14px",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          ورود به داشبورد
        </button>

        <a
          href="/dashboard?demo=1"
          style={{
            display: "inline-block",
            padding: "18px 28px",
            background: "#0891b2",
            color: "white",
            textDecoration: "none",
            borderRadius: "14px",
            fontSize: "16px",
          }}
        >
          ورود به دمو
        </a>
      </div>
    </main>
  );
}
