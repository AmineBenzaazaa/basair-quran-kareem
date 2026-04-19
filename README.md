# Tafsir App (Expo + TypeScript)

تطبيق تفسير عربي مبني على Expo + expo-router + Zustand، مع دعم RTL وخط عربي مناسب للقراءة، ويحمّل المحتوى المشترك من Supabase.

## التشغيل
1. تثبيت الحزم:
```bash
npm install
```
> ملاحظة: عند تحديث Expo، يُفضّل تشغيل:
```bash
npx expo install --fix
```
2. تشغيل التطبيق:
```bash
npm run start
```

## لوحة التحكم (Web Dashboard)
تمت إضافة بداية لوحة تحكم ويب داخل `dashboard/` بصيغة Next.js لتكون مناسبة للنشر على Vercel.

التشغيل المحلي:
```bash
cd dashboard
npm install
npm run dev
```

الإعداد المطلوب الآن:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` أو `SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` لعمليات الحفظ من لوحة التحكم

بعد تطبيق migrations ادفع المحتوى الابتدائي إلى القاعدة:
```bash
npx supabase db push
npm run supabase:content:push
```

بعدها:
- التطبيق يقرأ كل المحتوى المشترك من جدول `public.content_modules` في Supabase.
- اللوحة تقرأ وتكتب نفس الجدول مباشرة.
- أي تعديل من اللوحة ينعكس على التطبيق عبر Supabase Realtime مع refresh دوري.

راجع: `dashboard/README.md`

## مصدر البيانات
الـ runtime للمحتوى المشترك يعتمد على Supabase:
- `public.content_modules`

ملفات JSON المحلية أصبحت مصدر تأليف وبذور seed فقط وليست مصدر runtime داخل التطبيق:
- `src/data/content/glossary.json` (شرح المصطلحات + aliases + videos)
- `src/data/content/method.json` (أقسام المنهج)
- `assets/content/intro.json` (محتوى صفحة التعريف)
- `assets/content/rules.json` (شرح القواعد الكامل)
- `assets/content/concepts.json` (المعاني والدلالات)
- `assets/content/surahs.json` (قائمة السور)
- `assets/content/ayahs.json` (نصوص الآيات)
- `assets/content/tafsir.json` (فقرات التفسير)

ربط الكلمات الحمراء داخل الآيات يُشتق داخل التطبيق من المستندات المحمّلة من Supabase.

ملفات Word في `data/` هي صيغة التأليف. لا يوجد parsing لـ DOCX داخل التطبيق وقت التشغيل.

### تحديث المحتوى من Word
1. عدّل ملفات Word داخل `data/`.
2. شغّل:
```bash
npm run generate:content
```
3. ستتحدّث ملفات:
   - `src/data/content/glossary.json`
   - `assets/content/rules.json`
   - `src/data/content/method.json`

اختياري (watch mode):
```bash
npm run generate:content:watch
```

> ملاحظة: في مرحلة MVP الحالية لا يتم استخدام `المعاني والدلالات.docx` في runtime.

### توليد القرآن والتفسير (كامل)
لتحديث ملفات العرض القرآني (`surahs/ayahs/tafsir`) من ملف `تيسير القرآن بلسان العرب.docx`:
```bash
npm run generate:quran
```

### ربط الكلمة الحمراء بالشرح
- كل مفهوم يملك `conceptId` ثابت.
- كل فقرة شرح داخل المفهوم تملك `paragraphId` ثابت (`${conceptId}:pN`).
- عند الضغط على كلمة حمراء، يتم الانتقال إلى شاشة الشرح مع:
  - `conceptId`
  - `paragraphId` (إن توفر)
- شاشة الشرح تعمل scroll مباشر إلى الفقرة المستهدفة ثم تمييز مؤقت (`~1.5s`).

## إضافة سور/آيات/فيديوهات جديدة
1. أضف السورة في `assets/content/surahs.json`.
2. أضف الآيات في `assets/content/ayahs.json`.
3. أضف التفسير في `assets/content/tafsir.json`.
4. أضف المفردات الجديدة وروابط الفيديو في `src/data/content/glossary.json`.

## ملاحظات
- الخط المستخدم: Amiri عبر `@expo-google-fonts/amiri`.
- التطبيق يدعم RTL بالكامل مع محاذاة عربية للقراءة.
- المحتوى المشترك يعتمد على Supabase ولا يعمل بدون تهيئة القاعدة.
- الحالة الشخصية الحالية مثل `bookmarks` و`lastRead` و`settings` ما زالت محفوظة محلياً عبر AsyncStorage حتى يتم إضافة نظام مستخدمين.
