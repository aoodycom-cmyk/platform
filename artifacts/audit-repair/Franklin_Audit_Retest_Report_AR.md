# تقرير إصلاح وإعادة تدقيق Franklin

تاريخ التنفيذ: 2026-09-06 بتوقيت Asia/Riyadh

نطاق هذا التقرير هو طلب المالك فقط. الملفات المرفقة استُخدمت كأدلة اختبار وتكاثر للمشاكل، ولم تُعامل كتعليمات تنفيذ مستقلة.

## ملخص النتيجة

| البند | الحالة | الخلاصة |
| --- | --- | --- |
| تثبيت دلالات متطلبات السعر بين التقرير الحالي وإعادة التقييم | PASS | تمت إضافة حقول frozen semantics إلى القالب، وإعادة ترطيب الحقول المحذوفة من التقرير الحالي، ومنع تغيير النوع/الوحدة/الخط الأساس والحقول الدلالية القديمة. |
| منع التحويلات الرقمية غير الآمنة | PASS | أصبحت الحقول الرقمية القانونية تقبل JSON numbers finite فقط؛ السلاسل النصية والمصفوفات والـ booleans تُرفض بدلاً من تحويلها صامتاً. |
| بوابة سعر السوق والمصدر | PASS | لم يعد النظام يخترع marketPrice provenance. المصدر يجب أن يكون Market Data، برابط http(s)، وusedFor يحتوي marketPrice، وتاريخ المصدر يطابق asOf ولا يكون بعد تاريخ التحليل. |
| منع null/object-shape crashes | PASS | الـ normalizer لم يعد يرمي TypeError على عناصر null داخل المصفوفات؛ الـ validator يرفضها كأخطاء عقد واضحة. |
| قابلية إعادة إنتاج حسابات التقييم | PASS | يتم تصنيف كل طريقة صراحة. P/E وEV/EBITDA تصبحان VERIFIED فقط عند اكتمال المدخلات الرقمية وتطابق الحساب، والمدخلات المعروفة المشوهة تصبح ERROR، وبقية الطرق ومنها DCF تصبح NOT_VERIFIED بسبب عدم كفاية العقد لإعادة حساب حتمية. لا يوجد تنفيذ صيغ حرة. |
| مصدر الحقيقة بين src/public/docs | PASS | تم تشغيل build ومزامنة public/docs والتحقق محلياً عبر `pnpm run check:source-sync`. ملف workflow بقي مطابقاً لـ`main` ولم يُعدّل في فرق PR النهائي. |
| مصفوفة الحقول الكاملة | PASS | تم توليد matrix من 576 صفاً تغطي المسار من v3 input إلى validator/canonical/persistence/export/import/consumer/test. |
| WebKit managed browser | BLOCKED | بيئة الاختبار لا تحتوي Playwright WebKit binary المطلوبة. هذا قصور بيئة وليس فشل تطبيق. |
| اختبار Safari على iPhone فعلي | NOT_TESTED | لا يوجد جهاز iPhone/Safari فعلي متاح داخل هذه البيئة. |
| التحقق المستقل من صحة أرقام السوق/الملفات المالية خارج fixtures | NOT_TESTED | الإصلاح يتحقق من سلامة العقد والمنشأ والحسابات القابلة للإعادة، لا يدعي تدقيقاً مالياً مستقلاً لأرقام السوق الواقعية. |

## خط الأساس قبل الإصلاح

Baseline commit:

```text
e1ed5497cff317ada2725280f0fc63e62c669f20
```

قاعدة PR الحالية بعد دمج تغييرات `main`:

```text
b6b41c85695ff66edc9b7bc39c1609f7c886eee7
```

أُعيد تأسيس فرع الإصلاح فوق هذه القاعدة مع الاحتفاظ بتعديل iOS الخاص بإرجاع موضع ترويسة صفحة الأرباح بعد delayed scroll anchoring.

أوامر وأدلة التكاثر:

| الدليل | الحالة قبل الإصلاح |
| --- | --- |
| `artifacts/audit-repair/baseline-npm-test-ascii.log` | FAIL: الاختبار الافتراضي يفشل في مسار عربي بسبب استخدام `new URL(import.meta.url).pathname` بدلاً من `fileURLToPath`. |
| `artifacts/audit-repair/baseline-all-tests-summary.tsv` | FAIL: 58 نجاح / 6 فشل عند تشغيل ملفات الاختبار منفردة في clone بمسار ASCII. |
| `artifacts/audit-repair/baseline-probe-import.log` | FAIL: probe المرفق أثبت قبول numeric strings/arrays، null crashes، empty forecast، orphan source refs، وmarket source mutations. |
| `artifacts/audit-repair/baseline-check-mapping.log` | FAIL: mapping/template يفقد frozen semantics في previous requirements. |
| `artifacts/audit-repair/baseline-json-e2e-chrome.log` | PASS: Chrome E2E الأساسي كان يمر، لذلك الإصلاح ركز على العقد والتحقق وليس boot فقط. |
| `artifacts/audit-repair/baseline-json-e2e.log` | BLOCKED: Playwright managed Chromium binary غير موجود في البيئة. |

## الإصلاحات المنفذة

1. `v3InputNormalizer`

تمت إزالة اختراع provenance لسعر السوق، وإيقاف تحويل canonical numeric strings/arrays إلى أرقام، وتقييد alias parsing للحالات legacy فقط، وإضافة حراسة `isPlainObject` على عناصر المصفوفات قبل أي mutation.

2. `v3Validator`

أضيفت طبقة structural contract للحقول المتداخلة، فحص source references في forecast rows، إلزام `companyName` و`periodEndDate` وforecast غير فارغ، فحوص WACC/terminal growth، وبوابة مصدر السوق. حقول `financialNormalization` المعروفة تُفحص الآن ككائنات metric محددة الشكل، وقيمها غير الرقمية تُرفض بمسار JSON دقيق مع بقاء null المسموح به كما هو. كما تُرفض الأنواع المشوهة في مدخلات P/E وEV/EBITDA، ويصدر validator حالة منظمة لكل طريقة: VERIFIED أو NOT_VERIFIED أو ERROR. تبقى `financialNormalization={}` و`calculationAudit={}` حالتي warning حسب سياسة الاكتمال الحالية.

عقد v3 الحالي لا يحدد جدول تدفقات نقدية كامل مرتبطاً بالعملة والوحدة لكل فترة، ولا convention لتوقيت الخصم أو القيمة النهائية. لذلك لم يُخترع نموذج DCF جديد؛ تُصنف DCF وReverse DCF وطرق FCF غير المدعومة صراحةً كـ`NOT_VERIFIED`.

3. `v3Contract` و`v3Adapter`

قالب previous requirements صار يحمل frozen semantics كاملة. كما صار adapter يأخذ `currentReport` لإعادة ترطيب الحقول المحذوفة من المتطلبات القديمة، مع السماح فقط بتحديث حقول التقييم الحالية مثل `actualValue` و`status` و`evaluationNote`.

4. مسار الاستيراد الكامل

تم تمرير `currentReport` عبر `schema.js` و`parser.js` و`jsonContractRouter.js` حتى تعمل إعادة التقييم بالطريقة نفسها في strict parser، backend parser، وfull-analysis wrapper.

5. الاختبارات والتحقق من المزامنة

تمت إضافة `tests/franklinAuditRepair.test.mjs` وتحديث اختبارات قديمة كانت مربوطة بأسماء إصدارات stale بدلاً من سلوك حقيقي. توسع اختبار الإصلاح ليغطي الأنواع النصية والمصفوفات والكائنات والـbooleans في مدخلات P/E وEV/EBITDA، وأشكال financial normalization المشوهة، وحالات VERIFIED وNOT_VERIFIED. تم تشغيل فحص source-sync محلياً؛ لا يحتوي فرق PR النهائي على أي تعديل لـ`.github/workflows/mobile2-ci.yml`.

## إعادة الاختبار بعد الإصلاح

| الأمر/الدليل | النتيجة |
| --- | --- |
| `pnpm test` | PASS، محفوظ في `artifacts/audit-repair/final-pnpm-test.log`. |
| تشغيل كل `tests/*.test.mjs` منفرداً | PASS: 65/65، ملخص في `artifacts/audit-repair/final-all-tests-summary.tsv`. |
| `pnpm run check:source-sync` | PASS. |
| Probe الاستيراد المرفق | PASS من ناحية الإصلاح: الحالات الخطرة أصبحت invalid أو warnings حسب السياسة، محفوظ في `artifacts/audit-repair/final-probe-import.log`. |
| Probe mapping المرفق | PASS: القالب والـ adapter يحافظان على frozen semantics، محفوظ في `artifacts/audit-repair/final-check-mapping.log`. |
| Chrome JSON architecture E2E باستخدام system Chrome | PASS: import/save/reload/earnings/supplement/export/re-import/RTL/console/resource checks، محفوظ في `artifacts/audit-repair/final-json-e2e-chrome.log`. |
| Screenshot QA | PASS: صور mobile وdesktop محفوظة في `artifacts/audit-repair/screenshots/`. |
| WebKit smoke | BLOCKED: binary غير مثبت، محفوظ في `artifacts/audit-repair/final-webkit-smoke.log`. |

## المصفوفة

المصفوفة الكاملة موجودة هنا:

- `artifacts/audit-repair/v3-field-matrix.md`
- `artifacts/audit-repair/v3-field-matrix.json`

تم توليدها من `scripts/generate-v3-field-matrix.mjs` باستخدام fixture اصطناعي لإعادة تقييم الأرباح حتى تغطي مسارات previous/current requirements، forecast، valuation، sources، وmarketPrice.

## ملاحظات مستقلة

- لم تُحذف الاختبارات الفاشلة القديمة. الاختبارات التي كانت stale تم تحويلها إلى assertions سلوكية قابلة للاستمرار.
- لم يتم تعديل أي business claim لتمرير الاختبارات؛ الإصلاح في طبقة العقد والتحقق والتحويل ومسار الاستيراد.
- لا يدعي هذا العمل أن أرقام السوق أو القوائم المالية الواقعية صحيحة خارج fixtures المستخدمة. ما تم إثباته هو أن التطبيق لم يعد يقبل بنية/منشأ/حسابات خطرة كأنها تحليل صالح.
