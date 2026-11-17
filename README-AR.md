# كراسي — تخزين الصور داخل GitHub

هذه النسخة تُبقي واجهة الموقع على GitHub Pages، وتحفظ ملفات الصور نفسها داخل مستودع GitHub في المسارات:

`uploads/<المادة>/<l-or-e>/<timestamp>_<student>_<uuid>.jpg`

لا تستخدم Supabase. يلزم Cloudflare Worker كوسيط آمن فقط؛ الصور لا تُخزّن في Cloudflare.

## 1) ارفع الموقع إلى GitHub

1. أنشئ مستودعاً عاماً على GitHub.
2. ارفع `index.html` إلى جذر المستودع.
3. من Settings → Pages فعّل النشر من الفرع `main` والمجلد `/ (root)`.

## 2) جهّز صلاحية GitHub للـ Worker

1. من GitHub افتح Settings → Developer settings → Fine-grained personal access tokens.
2. أنشئ رمزاً جديداً خاصاً بهذا المستودع فقط.
3. اختر المستودع الذي يحتوي الموقع، وامنح Contents: Read and write.
4. لا تضع الرمز داخل `index.html` ولا ترسله لأي شخص.

## 3) انشر Cloudflare Worker

1. أنشئ Worker جديداً في Cloudflare.
2. انسخ محتوى `worker.js` إلى محرر Worker وانشره.
3. من Worker → Settings → Variables and Secrets أضف:
   - `GITHUB_TOKEN` (Secret): رمز GitHub الذي أنشأته.
   - `GITHUB_OWNER` (Text): اسم حساب GitHub أو المنظمة المالكة للمستودع.
   - `GITHUB_REPO` (Text): اسم المستودع فقط.
   - `GITHUB_BRANCH` (Text): غالباً `main`.
   - `ADMIN_KEY` (Secret): كلمة سر قوية جديدة للمشرف، لا تستخدم كلمة السر القديمة الموجودة في النسخة السابقة.
   - `ALLOWED_ORIGIN` (Text): رابط موقع GitHub Pages، مثال `https://USERNAME.github.io` أو رابط المشروع `https://USERNAME.github.io/REPO` بحسب عنوان الموقع الظاهر في المتصفح. إذا واجهت CORS، تأكد من كتابة Origin فقط دون المسار، مثل `https://USERNAME.github.io`.
4. احفظ المتغيرات وأعد نشر Worker.

## 4) اربط الموقع بالـ Worker

في أعلى `index.html` ابحث عن:

`const API_BASE='https://YOUR-WORKER.workers.dev';`

واستبدل الرابط بعنوان Worker الحقيقي، ثم ارفع `index.html` المعدّل إلى GitHub.

## 5) الاستخدام

- يسجل التلميذ الدخول باسمه، ثم يرفع الصور من المادة والصف المناسب.
- تحفظ الصور داخل مستودع GitHub وتظهر لكل زوار الموقع.
- الحذف متاح للمشرف فقط: اضغط زر المشرف وأدخل قيمة `ADMIN_KEY` التي أعددتها في Cloudflare.
- أسماء التلاميذ في شاشة الدخول ليست نظام تحقق من الهوية؛ أي شخص يمكنه اختيار اسم. الحذف محمي بمفتاح المشرف، لكن الرفع عام.

## ملاحظات مهمة

- GitHub هو مخزن الصور الدائم. Cloudflare Worker مجرد وسيط يحمي رمز GitHub.
- الصور تضغط إلى JPEG قبل الرفع، وبحد أقصى 3MB بعد الضغط.
- كل صورة ترفع تنشئ commit في المستودع؛ كثرة الصور الكبيرة قد تستهلك مساحة المستودع وتزيد سجل Git.
- هذا إعداد أولي مناسب لموقع صغير/مدرسي. إذا صار الموقع عاماً وكثيف الاستخدام، أضف CAPTCHA وحدود رفع ومراجعة المحتوى لمنع الإساءة.
- النسخة لا تستورد تلقائياً الصور القديمة المحفوظة في متصفحات الأجهزة؛ فهي كانت محلية في IndexedDB ولم تكن مرفوعة إلى أي خادم.
