# Loadder Domain Capability Map

## Vision

Loadder is a multi-domain website platform.

A website is not a fixed type.

A website is:

Core Website Engine
+
Enabled Capabilities
+
Sections
+
Theme
+
Published Runtime


---

# Core Capability

Available for every website.

Provides:

- Header
- Navigation
- Footer
- Hero
- Banner
- Gallery
- FAQ
- Rich Text
- Contact
- Trust Sections
- SEO
- Media


---

# Commerce Capability

Used by:

- Online stores
- Hybrid businesses

Provides:

Entities:

- Product
- Category
- Inventory
- Order
- Payment


Sections:

- Product Shelf
- Product Grid
- Product Detail
- Cart
- Checkout
- Flash Sale
- Category Shelf


Examples:

Kitchen Store:
commerce + content + forms

Electronics Store:
commerce + campaigns + content


---

# Booking Capability

Shared scheduling engine.

Used by:

- Clinics
- Academies
- Lawyers
- Consultants


Model:

Service

↓

Resource

↓

Availability

↓

Customer

↓

Appointment

↓

Payment (optional)


Sections:

- Booking CTA
- Appointment Form
- Calendar
- Availability


Examples:

Clinic:
Doctor + Treatment + Appointment

Academy:
Instructor + Course + Trial Lesson


---

# People Capability

Shared identity model.

Entity:

Person:

- name
- image
- bio
- specialties
- credentials
- availability


Used as:

Doctor

Instructor

Lawyer

Team Member


Sections:

- Profile Card
- Expert Grid
- Credentials


---

# Courses Capability

Used by:

- Academies
- Training businesses


Provides:

- Course
- Lesson
- Instructor
- Enrollment


Sections:

- Course Grid
- Course Detail
- Learning Path


---

# Services Capability

Used by:

- Clinics
- Companies
- Professional services


Provides:

- Service catalog
- Service detail


Sections:

- Service Grid
- Service Detail


---

# Forms Capability

Provides:

- Lead Capture
- Consultation Form
- Newsletter
- Registration Forms


Feeds:

CRM


---

# Content Capability

Provides:

- Blog
- Articles
- SEO Content
- Events


---

# Media Capability

Provides:

- Gallery
- Video
- Before/After
- Testimonials


---

# Example Presets


## Ecommerce Store

Capabilities:

- core
- commerce
- content
- forms


## Medical Clinic

Capabilities:

- core
- people
- services
- booking
- forms
- content
- media


## Music Academy

Capabilities:

- core
- people
- courses
- booking
- forms
- content


## Corporate Company

Capabilities:

- core
- services
- people
- forms
- content


---

# Architecture Rule

Industries are presets.

Capabilities are the building blocks.

New industries should reuse existing capabilities.
