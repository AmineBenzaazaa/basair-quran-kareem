import type { DashboardModule, DashboardModuleId } from "./types";

export const dashboardModules: DashboardModule[] = [
  {
    id: "intro",
    title: "تعريف التطبيق",
    area: "صفحة التعريف",
    description: "المحتوى الذي يظهر في صفحة تعريف التطبيق.",
    itemLabel: "قسم",
    addActionLabel: "إضافة قسم جديد",
    searchPlaceholder: "ابحث عن قسم أو عنوان",
    simpleInstructions: [
      "اختر القسم الذي تريد تعديله من القائمة.",
      "عدّل العنوان أو الفقرات ثم اضغط حفظ التعديلات.",
    ],
    repoRelativePath: "assets/content/intro.json",
    seedFileName: "intro.json",
  },
  {
    id: "concepts",
    title: "المعاني والدلالات",
    area: "المقالات",
    description: "محتوى المعاني والدلالات المعروض داخل التطبيق.",
    itemLabel: "قسم",
    addActionLabel: "إضافة قسم جديد",
    searchPlaceholder: "ابحث عن معنى أو عنوان",
    simpleInstructions: [
      "اختر القسم ثم عدّل الفقرات الظاهرة تحته.",
      "يمكنك إضافة قسم جديد أو حذف قسم غير مطلوب.",
    ],
    repoRelativePath: "assets/content/concepts.json",
    seedFileName: "concepts.json",
  },
  {
    id: "rules-article",
    title: "القواعد الأساسية",
    area: "شرح القواعد",
    description: "المصدر الأساسي المعتمد لشرح القواعد داخل التطبيق.",
    itemLabel: "قسم",
    addActionLabel: "إضافة قسم جديد",
    searchPlaceholder: "ابحث عن قاعدة أو عنوان",
    simpleInstructions: [
      "اختر القسم المطلوب ثم عدّل العنوان والفقرات.",
      "استخدم هذا القسم لشرح القواعد بشكل كامل.",
    ],
    repoRelativePath: "assets/content/rules.json",
    seedFileName: "rules-article.json",
  },
  {
    id: "method-flow",
    title: "الرسم البياني للمنهج القرآني",
    area: "الرسم البياني",
    description: "المحتوى المستخدم في شاشة الرسم البياني للمنهج القرآني.",
    itemLabel: "قسم",
    addActionLabel: "إضافة قسم جديد",
    searchPlaceholder: "ابحث عن جزء من المنهج",
    simpleInstructions: [
      "اختر الجزء الذي تريد تعديله من القائمة.",
      "عدّل الفقرات والنصوص الظاهرة ثم احفظ التغييرات.",
    ],
    repoRelativePath: "assets/content/method.json",
    seedFileName: "method-flow.json",
  },
  {
    id: "method-sections",
    title: "أقسام المنهج",
    area: "أقسام المنهج",
    description: "الأقسام المنظمة المستخدمة في طبقة المحتوى داخل التطبيق.",
    itemLabel: "قسم",
    addActionLabel: "إضافة قسم جديد",
    searchPlaceholder: "ابحث عن قسم من المنهج",
    simpleInstructions: [
      "يمكنك تعديل عنوان القسم ومحتواه بسهولة.",
      "أضف قسماً جديداً إذا احتجت إلى جزء جديد داخل المنهج.",
    ],
    repoRelativePath: "src/data/content/method.json",
    seedFileName: "method-sections.json",
  },
  {
    id: "glossary",
    title: "فهرس المفردات",
    area: "المفردات",
    description: "المصدر الأساسي للمفردات مع الأسماء البديلة والشرح والفيديوهات والحالة.",
    itemLabel: "مفردة",
    addActionLabel: "إضافة مفردة جديدة",
    searchPlaceholder: "ابحث عن مفردة أو كلمة",
    simpleInstructions: [
      "اختر المفردة من القائمة ثم عدّل الاسم والشرح والفقرات.",
      "يمكنك إضافة أسماء بديلة وروابط فيديو عند الحاجة.",
    ],
    repoRelativePath: "src/data/content/glossary.json",
    seedFileName: "glossary.json",
  },
  {
    id: "surahs",
    title: "السور",
    area: "القرآن",
    description: "قائمة السور المستخدمة في مسار القرآن داخل التطبيق.",
    itemLabel: "سورة",
    addActionLabel: "إضافة سورة جديدة",
    searchPlaceholder: "ابحث عن سورة",
    simpleInstructions: [
      "يمكنك تعديل اسم السورة وعدد الآيات.",
      "اختر السورة المطلوبة من القائمة ثم احفظ التغييرات.",
    ],
    repoRelativePath: "assets/content/surahs.json",
    seedFileName: "surahs.json",
    readOnly: true,
  },
  {
    id: "ayahs",
    title: "الآيات",
    area: "القرآن",
    description: "نصوص الآيات المعروضة في شاشة القرآن.",
    itemLabel: "آية",
    addActionLabel: "إضافة آية جديدة",
    searchPlaceholder: "ابحث برقم السورة أو الآية",
    simpleInstructions: [
      "اختر الآية من القائمة باستخدام البحث لتصل إليها بسرعة.",
      "عدّل نص الآية فقط ثم اضغط حفظ التعديلات.",
    ],
    repoRelativePath: "assets/content/ayahs.json",
    seedFileName: "ayahs.json",
    readOnly: true,
  },
  {
    id: "tafsir",
    title: "التفسير",
    area: "القرآن والتفسير",
    description: "فقرات التفسير المعروضة في شاشة القراءة.",
    itemLabel: "تفسير آية",
    addActionLabel: "إضافة تفسير جديد",
    searchPlaceholder: "ابحث برقم السورة أو الآية",
    simpleInstructions: [
      "اختر الآية المطلوبة من القائمة ثم عدّل فقرات التفسير.",
      "كل فقرة يمكن تعديلها مباشرة من داخل الحقول.",
    ],
    repoRelativePath: "assets/content/tafsir.json",
    seedFileName: "tafsir.json",
  },
  {
    id: "verses-tokens",
    title: "الكلمات المميزة (الوسوم الحمراء)",
    area: "القرآن والتفسير",
    description: "إدارة الكلمات ذات الوسوم الحمراء في الآيات وربطها بالمفردات والشرح.",
    itemLabel: "كلمة مميزة",
    addActionLabel: "إضافة كلمة مميزة جديدة",
    searchPlaceholder: "ابحث برقم السورة أو الآية أو الكلمة",
    simpleInstructions: [
      "اختر الآية من القائمة أو ابحث عنها برقم السورة والآية.",
      "اضغط على أي كلمة في الآية لتمييزها باللون الأحمر.",
      "اختر المفردة المرتبطة من القائمة المنسدلة.",
      "يمكنك معاينة كيف ستظهر الكلمات في التطبيق قبل الحفظ.",
    ],
    repoRelativePath: "src/data/generated/verses.json",
    seedFileName: "verses-tokens.json",
  },
];

const moduleById = new Map<DashboardModuleId, DashboardModule>(
  dashboardModules.map((module) => [module.id, module])
);

export function getDashboardModule(
  moduleId: string
): DashboardModule | null {
  return moduleById.get(moduleId as DashboardModuleId) ?? null;
}
