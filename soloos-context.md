{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\froman\fcharset0 Times-Bold;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\sa321\partightenfactor0

\f0\b\fs48 \cf0 \expnd0\expndtw0\kerning0
# SoloOS Product Context\
\
This file contains the full product specification and context for the SoloOS SaaS application.\
\
All code generated for this project must strictly follow the architecture, UX philosophy and constraints described in this document.\
\
This context file must always be read before generating or modifying code.\
\
---\
\
# Product Overview\
\
Product Name: SoloOS\
\
SoloOS is a Career and Freelance Operating System designed to help professionals manage their job search and freelance work in one place.\
\
The product combines resume management, AI-powered cover letter generation and job application tracking into a single workflow.\
\
The goal of SoloOS is to remove friction from the job application process.\
\
---\
\
# Target Users\
\
Primary users include:\
\
- Designers\
- Developers\
- Product Managers\
- Marketers\
- Freelancers\
- Remote job seekers\
\
Typical behavior:\
\
Users apply to many jobs and frequently customize resumes and cover letters.\
\
Currently this process is fragmented across:\
\
- Google Docs\
- Notion\
- spreadsheets\
- email drafts\
- random files\
\
SoloOS centralizes this workflow.\
\
---\
\
# Core MVP Features\
\
The first version of SoloOS must implement only three core modules.\
\
## 1. Resume Builder\
\
Users can create and edit professional resumes.\
\
Features:\
\
- create resumes\
- edit resume sections\
- add experience entries\
- add skills\
- add education\
- AI-assisted text improvement\
- live preview\
- PDF export\
\
---\
\
## 2. AI Cover Letter Generator\
\
Users paste a job description and Gemini AI generates a tailored cover letter.\
\
Features:\
\
- generate cover letter\
- rewrite text\
- shorten text\
- expand text\
- regenerate variations\
\
---\
\
## 3. Job Application Tracker\
\
Users track job applications using a Kanban board.\
\
Application statuses:\
\
- Saved\
- Applied\
- Interview\
- Offer\
- Rejected\
\
Users can manually add jobs from any platform.\
\
Examples:\
\
- LinkedIn\
- Indeed\
- Upwork\
- Glassdoor\
- Telegram job channels\
\
---\
\
# Product Structure\
\
Main pages:\
\
Landing  \
Login  \
Dashboard  \
Resumes  \
Resume Editor  \
Cover Letters  \
Job Tracker  \
Settings\
\
---\
\
# UX Philosophy\
\
SoloOS must follow a high-end SaaS design philosophy inspired by products such as:\
\
- Linear\
- Raycast\
- Superhuman\
- Notion\
\
Design principles:\
\
Minimal interface  \
High information density  \
Fast interactions  \
Clean typography  \
No visual noise  \
\
The interface should feel professional and calm.\
\
---\
\
# Design System\
\
Primary interface style: dark professional interface.\
\
## Colors\
\
Background: #0A0A0B  \
Surface: #111113  \
Surface Elevated: #18181B  \
\
Primary Text: #FFFFFF  \
Secondary Text: #A1A1AA  \
Muted Text: #71717A  \
\
Accent Color: #6366F1  \
Success: #22C55E  \
Warning: #F59E0B  \
Error: #EF4444\
\
---\
\
## Typography\
\
Font: Inter\
\
Type scale:\
\
Hero: 36px  \
H1: 28px  \
H2: 22px  \
H3: 18px  \
Body: 15px  \
Small: 13px\
\
---\
\
# Layout Structure\
\
Application layout:\
\
Sidebar navigation + main workspace.\
\
Sidebar width: 240px\
\
Sidebar navigation items:\
\
Dashboard  \
Resumes  \
Cover Letters  \
Job Tracker  \
Settings\
\
---\
\
# Resume Builder UX\
\
Resume builder layout:\
\
Left sidebar: section list  \
Center: editable content  \
Right panel: live resume preview\
\
Resume sections:\
\
Personal Info  \
Summary  \
Experience  \
Education  \
Skills  \
Projects\
\
Users must see a live preview while editing.\
\
---\
\
# AI Integration\
\
The application uses Google Gemini API.\
\
AI is used for:\
\
- rewriting resume experience\
- improving bullet points\
- generating cover letters\
- rewriting generated text\
\
AI should be integrated as actions inside the interface.\
\
Example buttons:\
\
"Improve with AI"  \
"Rewrite"  \
"Make shorter"  \
"Make stronger"\
\
AI should not appear as a chat interface.\
\
---\
\
# Activation Flow\
\
The first user experience must be fast.\
\
Activation flow:\
\
Login  \
Create Resume  \
Improve Resume with AI  \
Download Resume PDF\
\
The user should achieve value within two minutes.\
\
---\
\
# Multilanguage Support\
\
Primary interface language: English\
\
Additional supported languages:\
\
Russian  \
Armenian\
\
Documents can be created in different languages.\
\
Language must be stored in database.\
\
Example:\
\
language = en  \
language = ru  \
language = hy\
\
---\
\
# Export Rules\
\
Generated files must follow consistent naming.\
\
Example resume export:\
\
First_Last_Position_CV_EN.pdf\
\
Example:\
\
Garri_Avetisyan_Product_Designer_CV_EN.pdf\
\
Invoice example (future module):\
\
INV-0001_ClientName_2026.pdf\
\
---\
\
# Technology Stack\
\
Frontend:\
\
Next.js  \
TailwindCSS  \
shadcn/ui components\
\
Backend:\
\
Supabase (PostgreSQL)\
\
Authentication:\
\
Supabase Auth with Google login\
\
AI:\
\
Google Gemini API\
\
Hosting:\
\
Vercel\
\
Telegram integration may be added later for notifications.\
\
---\
\
# Database Architecture\
\
The application uses Supabase PostgreSQL.\
\
Core tables:\
\
Users  \
Resumes  \
Experiences  \
Jobs  \
CoverLetters\
\
---\
\
## Users\
\
Fields:\
\
id (uuid)  \
email  \
name  \
language  \
created_at\
\
---\
\
## Resumes\
\
Fields:\
\
id  \
user_id  \
title  \
summary  \
language  \
created_at\
\
---\
\
## Experiences\
\
Fields:\
\
id  \
resume_id  \
company  \
role  \
description  \
start_date  \
end_date\
\
---\
\
## Jobs\
\
Fields:\
\
id  \
user_id  \
company  \
position  \
link  \
status  \
notes  \
created_at\
\
Status values:\
\
saved  \
applied  \
interview  \
offer  \
rejected\
\
---\
\
## CoverLetters\
\
Fields:\
\
id  \
user_id  \
job_description  \
generated_text  \
created_at\
\
---\
\
# Development Rules\
\
When generating code for this project:\
\
1. Follow the architecture described in this document.\
2. Do not invent alternative database schemas.\
3. Maintain clean modular code.\
4. Ensure high performance and minimal UI latency.\
5. Maintain a minimal and professional interface.\
\
---\
\
# Product Goal\
\
The goal of SoloOS is not to build a simple resume generator.\
\
The goal is to build a career operating system that helps professionals manage their job search workflow efficiently.\
\
Initial success metric:\
\
First 10 active users.\
\
The focus must remain on simplicity, performance and professional UX.\
}