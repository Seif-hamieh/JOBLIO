import type { Locale } from "@/i18n/config";

// Long-form copy for the public About / Terms / Privacy / Contact pages, kept
// out of the UI dictionaries. Each page exists in every locale.
// NOTE: Terms and Privacy are a plain-language baseline describing how JOBLIO
// actually works; have them reviewed for your jurisdiction before relying on them.

export type StaticSection = { heading: string; body: string[] };
export type StaticPage = { title: string; intro: string; updated?: string; sections: StaticSection[] };
export type StaticPageId = "about" | "terms" | "privacy" | "contact";

const UPDATED_EN = "Last updated: 14 October 2026";
const UPDATED_AR = "آخر تحديث: 14 أكتوبر 2026";

export const STATIC_PAGES: Record<StaticPageId, Record<Locale, StaticPage>> = {
  about: {
    en: {
      title: "About JOBLIO",
      intro:
        "JOBLIO is a professional network and hiring platform for people and companies everywhere — in English and Arabic. Build a professional identity, discover opportunities, and hire with matching you can actually understand.",
      sections: [
        {
          heading: "Transparent matching, no AI",
          body: [
            "Every match percentage on JOBLIO comes from published rules — skills, experience, location and work mode, job type, salary, education, languages and industry — each with a fixed weight.",
            "Next to every score we show exactly which criteria were met and which weren't. There are no hidden models, no machine learning and no AI-generated recommendations.",
          ],
        },
        {
          heading: "For professionals",
          body: [
            "Create a profile that goes beyond a CV: skills with levels, experience, projects, certifications, languages and a career journey. Search and apply for jobs, follow companies and connect with people in your field.",
            "Creating an account, building your profile, searching, applying, connecting and messaging are free.",
          ],
        },
        {
          heading: "For companies",
          body: [
            "Publish jobs, see candidates ranked by the same transparent rules, move them through a visual hiring pipeline, schedule interviews and build a company page that shows what working with you is like.",
          ],
        },
        {
          heading: "How we make money",
          body: [
            "Optional paid features increase visibility — such as Profile Boost, Featured Jobs, Urgent Hire, Priority Application, Job Seeker Pro and Company Premium. Sponsored content is always labelled, and paying never changes how a match is calculated.",
          ],
        },
      ],
    },
    ar: {
      title: "عن JOBLIO",
      intro:
        "JOBLIO شبكة مهنية ومنصة توظيف للأفراد والشركات في كل مكان، باللغتين العربية والإنجليزية. ابنِ هويتك المهنية، واكتشف الفرص، ووظّف بمطابقة يمكنك فهمها فعلًا.",
      sections: [
        {
          heading: "مطابقة شفافة بلا ذكاء اصطناعي",
          body: [
            "كل نسبة مطابقة في JOBLIO ناتجة عن قواعد معلنة: المهارات، والخبرة، والموقع ونمط العمل، ونوع الوظيفة، والراتب، والتعليم، واللغات، والقطاع، ولكلٍّ منها وزن ثابت.",
            "نعرض بجانب كل نتيجة المعايير التي تحققت والتي لم تتحقق بالضبط. لا نماذج خفية، ولا تعلّم آلي، ولا توصيات يولّدها الذكاء الاصطناعي.",
          ],
        },
        {
          heading: "للمهنيين",
          body: [
            "أنشئ ملفًا شخصيًا يتجاوز السيرة الذاتية: مهارات بمستوياتها، وخبرات، ومشاريع، وشهادات، ولغات، ومسيرة مهنية. ابحث عن الوظائف وتقدّم إليها، وتابع الشركات، وتواصل مع أهل مجالك.",
            "إنشاء الحساب وبناء الملف الشخصي والبحث والتقديم والتواصل والمراسلة كلها مجانية.",
          ],
        },
        {
          heading: "للشركات",
          body: [
            "انشر الوظائف، واطّلع على المرشحين مرتّبين وفق القواعد الشفافة نفسها، وانقلهم عبر مراحل توظيف مرئية، وحدّد المقابلات، وأنشئ صفحة شركة تُظهر كيف يبدو العمل معكم.",
          ],
        },
        {
          heading: "كيف نحقق الدخل",
          body: [
            "ميزات مدفوعة اختيارية تزيد الظهور، مثل تعزيز الملف والوظائف المميزة والتوظيف العاجل والتقديم بأولوية وباحث عن عمل برو وصفحات الشركات المميزة. المحتوى المموّل يُوسم دائمًا بوضوح، والدفع لا يغيّر طريقة حساب المطابقة أبدًا.",
          ],
        },
      ],
    },
  },

  terms: {
    en: {
      title: "Terms of Service",
      updated: UPDATED_EN,
      intro: "These terms explain the rules for using JOBLIO. By creating an account or using the site, you agree to them.",
      sections: [
        {
          heading: "1. Your account",
          body: [
            "You must give accurate information, keep your password safe and be at least 16 years old. You are responsible for activity on your account. One person, one personal account; company pages must be created by someone authorised to represent the company.",
          ],
        },
        {
          heading: "2. Your content",
          body: [
            "You own what you post — your profile, CV, posts, messages and company content. You give JOBLIO permission to store and display it as needed to run the service (for example, showing your profile to recruiters if you allow it). You can edit or delete it at any time.",
          ],
        },
        {
          heading: "3. Acceptable use",
          body: [
            "Keep it professional and honest. Do not post fake jobs or profiles, misleading pay information, discriminatory requirements, spam, malware or anything illegal. Do not scrape the site, harvest contact details or try to break its security.",
            "We may remove content or suspend accounts that break these rules.",
          ],
        },
        {
          heading: "4. Jobs and hiring",
          body: [
            "JOBLIO connects candidates and employers; we are not a party to any employment relationship and do not guarantee interviews, offers or hires. Employers are responsible for their job posts and hiring decisions. Match percentages are calculated by published rules and are guidance, not a promise.",
          ],
        },
        {
          heading: "5. Paid features",
          body: [
            "Paid features are described with their price and duration before you buy. Payments are processed by Paddle (as merchant of record); JOBLIO never sees your card details. Subscriptions renew until cancelled and can be managed from Billing & Payments, or through Paddle's hosted customer portal. Visibility features increase exposure but do not guarantee results.",
          ],
        },
        {
          heading: "6. Availability and liability",
          body: [
            "We work to keep JOBLIO available and secure, but the service is provided as is and may change or be interrupted. To the extent the law allows, JOBLIO is not liable for indirect losses or for content posted by users.",
          ],
        },
        {
          heading: "7. Ending your use",
          body: ["You can delete your account at any time from Settings. We may end accounts that seriously or repeatedly break these terms."],
        },
        {
          heading: "8. Changes",
          body: ["If we change these terms in a meaningful way, we will update the date above and let members know before the changes apply."],
        },
      ],
    },
    ar: {
      title: "شروط الخدمة",
      updated: UPDATED_AR,
      intro: "توضّح هذه الشروط قواعد استخدام JOBLIO. بإنشائك حسابًا أو استخدامك الموقع فإنك توافق عليها.",
      sections: [
        {
          heading: "1. حسابك",
          body: [
            "يجب أن تقدّم معلومات صحيحة، وأن تحافظ على سرية كلمة المرور، وألّا يقل عمرك عن 16 عامًا. أنت مسؤول عن النشاط في حسابك. لكل شخص حساب شخصي واحد، ويجب أن يُنشئ صفحات الشركات شخصٌ مخوّل بتمثيل الشركة.",
          ],
        },
        {
          heading: "2. محتواك",
          body: [
            "ما تنشره ملكك: ملفك الشخصي وسيرتك الذاتية ومنشوراتك ورسائلك ومحتوى شركتك. وتمنح JOBLIO الإذن بتخزينه وعرضه بالقدر اللازم لتشغيل الخدمة (مثل عرض ملفك على مسؤولي التوظيف إن سمحت بذلك). يمكنك تعديله أو حذفه في أي وقت.",
          ],
        },
        {
          heading: "3. الاستخدام المقبول",
          body: [
            "حافظ على المهنية والصدق. لا تنشر وظائف أو ملفات مزيّفة، ولا معلومات رواتب مضلِّلة، ولا شروطًا تمييزية، ولا رسائل مزعجة أو برمجيات خبيثة أو أي محتوى مخالف للقانون. لا تجمع بيانات الموقع آليًا، ولا تستخلص بيانات التواصل، ولا تحاول اختراق أمانه.",
            "يحق لنا إزالة المحتوى أو إيقاف الحسابات المخالفة لهذه القواعد.",
          ],
        },
        {
          heading: "4. الوظائف والتوظيف",
          body: [
            "يربط JOBLIO المرشحين بأصحاب العمل، ولسنا طرفًا في أي علاقة عمل، ولا نضمن مقابلات أو عروضًا أو تعيينات. أصحاب العمل مسؤولون عن إعلاناتهم وقرارات التوظيف. نسب المطابقة تُحسب بقواعد معلنة وهي للاسترشاد لا وعدٌ بنتيجة.",
          ],
        },
        {
          heading: "5. الميزات المدفوعة",
          body: [
            "توضَّح الميزات المدفوعة بسعرها ومدتها قبل الشراء. تُعالَج المدفوعات عبر Paddle (بصفته التاجر المسجَّل)، ولا يطّلع JOBLIO على بيانات بطاقتك. تتجدد الاشتراكات حتى تُلغى، ويمكن إدارتها من صفحة الفوترة والمدفوعات، أو عبر بوابة Paddle المخصصة للعملاء. ميزات الظهور تزيد الانتشار لكنها لا تضمن نتائج.",
          ],
        },
        {
          heading: "6. التوفّر والمسؤولية",
          body: [
            "نعمل على إبقاء JOBLIO متاحًا وآمنًا، لكن الخدمة تُقدَّم كما هي وقد تتغير أو تنقطع. وفي الحدود التي يسمح بها القانون، لا يتحمل JOBLIO المسؤولية عن الخسائر غير المباشرة أو عن المحتوى الذي ينشره المستخدمون.",
          ],
        },
        {
          heading: "7. إنهاء الاستخدام",
          body: ["يمكنك حذف حسابك في أي وقت من الإعدادات. ويحق لنا إنهاء الحسابات التي تخالف هذه الشروط مخالفة جسيمة أو متكررة."],
        },
        {
          heading: "8. التغييرات",
          body: ["إذا غيّرنا هذه الشروط تغييرًا جوهريًا فسنحدّث التاريخ أعلاه ونُعلم الأعضاء قبل سريان التغييرات."],
        },
      ],
    },
  },

  privacy: {
    en: {
      title: "Privacy Policy",
      updated: UPDATED_EN,
      intro: "This policy explains what personal data JOBLIO collects, why, where it is stored, and the choices you have.",
      sections: [
        {
          heading: "What we collect",
          body: [
            "Account details: your name, email address and password (stored only as a secure hash). If you sign in with Google, we receive your name, email and profile photo from Google.",
            "Profile and activity: what you add to your profile (experience, skills, CV, photos and more), your applications, posts, messages, connections, follows and saved items.",
            "Technical data: the session cookie that keeps you signed in, your language and theme choices, and basic logs needed to run and secure the service.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "To run JOBLIO: show your profile, calculate rule-based matches, deliver messages and notifications, process payments, prevent abuse and keep the service secure. We do not sell your personal data and we do not use it to train AI models.",
          ],
        },
        {
          heading: "Who can see your information",
          body: [
            "You control your profile's visibility (everyone, members only or your connections), whether recruiters can find you in search, and who can message you, in Settings → Privacy. Your saved CV is private: only you and recruiters allowed by those settings, or companies you applied to, can open it.",
          ],
        },
        {
          heading: "Where your data is stored",
          body: [
            "JOBLIO uses trusted providers to run the service: Vercel (hosting), Neon (database, in the EU), Supabase (file storage), Paddle (payments), Google (optional sign-in) and an email provider for account emails. They process data only to provide their service to us.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "We use only cookies needed for the site to work: your sign-in session, your language and your theme. We do not use advertising or cross-site tracking cookies.",
          ],
        },
        {
          heading: "Your choices and rights",
          body: [
            "You can view and edit your data at any time from your profile and settings, and delete your account from Settings — which removes your profile and personal content. Depending on where you live, you may have further rights, such as access, correction, portability or objection; contact us to use them.",
          ],
        },
        {
          heading: "Retention and security",
          body: [
            "We keep your data while your account is active and delete it when you delete your account, except where we must keep records (for example, payment invoices) by law. Data is encrypted in transit, passwords are hashed and access is limited to what each feature needs.",
          ],
        },
        {
          heading: "Changes",
          body: ["If we change this policy in a meaningful way, we will update the date above and let members know."],
        },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      updated: UPDATED_AR,
      intro: "توضّح هذه السياسة البيانات الشخصية التي يجمعها JOBLIO، ولماذا، وأين تُخزَّن، والخيارات المتاحة لك.",
      sections: [
        {
          heading: "ما الذي نجمعه",
          body: [
            "بيانات الحساب: اسمك وبريدك الإلكتروني وكلمة المرور (تُخزَّن فقط بصيغة مشفّرة آمنة). وإذا سجّلت الدخول عبر Google فإننا نتلقى اسمك وبريدك وصورة ملفك من Google.",
            "الملف الشخصي والنشاط: ما تضيفه إلى ملفك (الخبرات والمهارات والسيرة الذاتية والصور وغيرها)، وطلباتك، ومنشوراتك، ورسائلك، واتصالاتك، ومتابعاتك، والعناصر المحفوظة.",
            "البيانات التقنية: ملف تعريف الجلسة الذي يبقيك مسجّل الدخول، واختياراتك للغة والمظهر، وسجلات أساسية لازمة لتشغيل الخدمة وتأمينها.",
          ],
        },
        {
          heading: "كيف نستخدمها",
          body: [
            "لتشغيل JOBLIO: عرض ملفك، وحساب المطابقة القائمة على القواعد، وإيصال الرسائل والإشعارات، ومعالجة المدفوعات، ومنع إساءة الاستخدام، وحماية الخدمة. لا نبيع بياناتك الشخصية، ولا نستخدمها لتدريب نماذج ذكاء اصطناعي.",
          ],
        },
        {
          heading: "من يمكنه رؤية معلوماتك",
          body: [
            "تتحكم في ظهور ملفك (للجميع، أو للأعضاء فقط، أو لاتصالاتك)، وفي إمكانية عثور مسؤولي التوظيف عليك في البحث، وفيمن يمكنه مراسلتك، من الإعدادات ← الخصوصية. سيرتك الذاتية المحفوظة خاصة: لا يفتحها إلا أنت، ومسؤولو التوظيف الذين تسمح لهم إعداداتك، أو الشركات التي تقدّمت إليها.",
          ],
        },
        {
          heading: "أين تُخزَّن بياناتك",
          body: [
            "يستعين JOBLIO بمزوّدين موثوقين لتشغيل الخدمة: Vercel (الاستضافة)، وNeon (قاعدة البيانات داخل الاتحاد الأوروبي)، وSupabase (تخزين الملفات)، وPaddle (المدفوعات)، وGoogle (تسجيل دخول اختياري)، ومزوّد بريد لرسائل الحساب. ويعالج هؤلاء البيانات فقط لتقديم خدماتهم لنا.",
          ],
        },
        {
          heading: "ملفات تعريف الارتباط",
          body: [
            "نستخدم فقط ملفات تعريف الارتباط اللازمة لعمل الموقع: جلسة تسجيل الدخول، واللغة، والمظهر. لا نستخدم ملفات إعلانية أو للتتبع عبر المواقع.",
          ],
        },
        {
          heading: "خياراتك وحقوقك",
          body: [
            "يمكنك الاطلاع على بياناتك وتعديلها في أي وقت من ملفك وإعداداتك، وحذف حسابك من الإعدادات، وهو ما يزيل ملفك ومحتواك الشخصي. وبحسب مكان إقامتك قد تكون لك حقوق إضافية مثل الوصول والتصحيح والنقل والاعتراض؛ تواصل معنا لممارستها.",
          ],
        },
        {
          heading: "الاحتفاظ والأمان",
          body: [
            "نحتفظ ببياناتك ما دام حسابك نشطًا، ونحذفها عند حذف حسابك، إلا ما يلزمنا القانون بالاحتفاظ به (مثل فواتير الدفع). البيانات مشفّرة أثناء النقل، وكلمات المرور مشفّرة، والوصول مقصور على ما تحتاجه كل ميزة.",
          ],
        },
        {
          heading: "التغييرات",
          body: ["إذا غيّرنا هذه السياسة تغييرًا جوهريًا فسنحدّث التاريخ أعلاه ونُعلم الأعضاء."],
        },
      ],
    },
  },

  contact: {
    en: {
      title: "Contact us",
      intro: "Questions, feedback or a problem with your account? We read every message.",
      sections: [
        {
          heading: "Help with your account",
          body: [
            "Most account settings — email, password, privacy, notifications and deleting your account — are in Settings. If you can't sign in, use “Forgot password” on the sign-in page.",
          ],
        },
        {
          heading: "Report a problem",
          body: [
            "To report a fake job, an inappropriate profile or a security issue, email us with a link to the page and a short description. Security reports are handled first.",
          ],
        },
        {
          heading: "Companies and billing",
          body: ["For company pages, Company Premium or a question about an invoice, include your company name and the invoice number if you have one."],
        },
      ],
    },
    ar: {
      title: "تواصل معنا",
      intro: "لديك سؤال أو ملاحظة أو مشكلة في حسابك؟ نقرأ كل رسالة.",
      sections: [
        {
          heading: "المساعدة في حسابك",
          body: [
            "معظم إعدادات الحساب، كالبريد وكلمة المرور والخصوصية والإشعارات وحذف الحساب، موجودة في الإعدادات. وإذا تعذّر عليك تسجيل الدخول فاستخدم «نسيت كلمة المرور» في صفحة تسجيل الدخول.",
          ],
        },
        {
          heading: "الإبلاغ عن مشكلة",
          body: [
            "للإبلاغ عن وظيفة مزيّفة أو ملف غير لائق أو مشكلة أمنية، راسلنا برابط الصفحة ووصف مختصر. تُعالَج البلاغات الأمنية أولًا.",
          ],
        },
        {
          heading: "الشركات والفوترة",
          body: ["لأسئلة صفحات الشركات أو Company Premium أو الفواتير، اذكر اسم شركتك ورقم الفاتورة إن وُجد."],
        },
      ],
    },
  },
};
