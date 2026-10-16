# Franklin Financial Verification Contract

آخر تحديث: 2026-10-16
الإصدار التشغيلي: `franklin-fair-value/v3` مع Prompt أولي `v6` وPrompt إعادة تقييم `v4`

## 1. توزيع المسؤوليات

- الذكاء الاصطناعي يقترح طرق التقييم، المدخلات، الافتراضات، الأوزان، السيناريوهات، التفسير، والقرار الاستثماري.
- Franklin يحتفظ بالنص الخام كما ورد لأغراض التدقيق، لكنه لا يعامله بوصفه مصدر الحقيقة الحسابي.
- Franklin يعيد حساب طرق التقييم والقيمة النهائية والمتوسط المرجح وBase، ثم يفحص الاتساق المالي والمصادر والقرار.
- لا يعرض Franklin التحليل بوصفه متحققًا إلا إذا اجتاز كل البوابات المطلوبة.

## 2. حالات التحقق

| الحالة | معناها | أثر العرض |
|---|---|---|
| `VERIFIED` | الحسابات قابلة لإعادة الإنتاج، Base متصالح، والبيانات الجوهرية موثقة وفق العقد | يمكن عرض Verified مع بيان أن التحقق الخارجي من محتوى المصدر لم يُجرَ |
| `NEEDS_REVIEW` | الحساب صحيح مبدئيًا لكن التفسير أو provenance أو ملاءمة الطريقة أو بيانات الاكتمال تحتاج مراجعة | لا يجوز وصفه بتحليل كامل |
| `INSUFFICIENT_DATA` | لا توجد بيانات كافية لإعادة حساب موثوق أو يوجد sourceId غير قابل للحل | امتناع عن الاعتماد المالي |
| `BLOCKED` | يوجد تعارض حسابي/مالي/نصي جوهري | يمنع الاعتماد والعرض بوصفه صالحًا |

ترتيب التصعيد هو: `VERIFIED < NEEDS_REVIEW < INSUFFICIENT_DATA < BLOCKED`.

## 3. هامش المطابقة

تتطابق القيمة المبلّغ عنها مع قيمة Franklin المعاد حسابها عندما يكون الفرق أقل من أو يساوي الأكبر من:

- `0.01` من وحدة العملة؛ أو
- `0.1%` من أكبر القيمتين بالقيمة المطلقة.

هذا الهامش للتقريب العددي فقط، وليس سماحًا بتغيير افتراض اقتصادي.

## 4. عقد Base والأوزان

- كل وزن داخل `valuation.valuationResults[]` يجب أن يكون محدودًا وموجبًا.
- مجموع الأوزان يجب أن يساوي `100%` ضمن هامش التحقق البنيوي القائم.
- يعيد Franklin حساب كل طريقة ذات وزن موجب، ثم يحسب:

  `weightedFairValue = Σ(recalculatedMethodFairValue × weight / 100)`

- يجب أن تساوي `valuation.current.base` القيمة المرجحة المعاد حسابها ضمن هامش المطابقة.
- `valuation.calculationAudit` إلزامي للحالة Verified، ويجب أن يحتوي أرقام المصالحة كاملة.
- يجب أن يكون `analystOverlayPct = 0`. يوضع الحكم التحليلي داخل المدخلات والأوزان والسيناريوهات مع تفسيره، لا داخل قيمة منفصلة غير قابلة لإعادة الإنتاج.
- لا يمكن تغيير مدخلات P/E أو DCF أو أي طريقة مع إبقاء Base قديمة والحصول على Verified.

## 5. طرق التقييم القابلة لإعادة الحساب

| الطريقة | إعادة حساب Franklin |
|---|---|
| P/E | `normalizedForwardEps × impliedMultiple`؛ كلاهما موجب |
| EV/EBITDA | `((normalizedEbitda × evEbitdaMultiple) - netDebt + nonOperatingAdjustments) / dilutedShares` |
| EV/EBIT | `((normalizedEbit × evEbitMultiple) - netDebt) / dilutedShares` |
| P/FCF | `normalizedFreeCashFlowPerShare × impliedMultiple`، أو اشتقاق FCF للسهم من FCF والأسهم |
| SOTP | `(Σ componentEquityValues + corporateAdjustments) / dilutedShares` |
| DCF | خصم كل تدفق بفترته، اشتقاق Terminal Value، تنفيذ جسر FCFF/FCFE الصحيح، ثم القسمة على الأسهم |

إذا كانت الطريقة غير مدعومة بحاسبة حتمية أو كانت مدخلاتها ناقصة، تكون الحالة `INSUFFICIENT_DATA` ولا تُمنح Verified.

## 6. عقد DCF

لكي يكون DCF مكتملًا يجب توضيح:

- `valuationDate`
- `cashFlowType`: إحدى `FCFF` أو `FCFE`
- `discountRateType`: `WACC` لـFCFF أو `COST_OF_EQUITY` لـFCFE
- `forecastFreeCashFlows` و`discountPeriods`
- `discountRatePct`، ويجب أن يكون أكبر من 0% ولا يتجاوز 50%
- `terminalValueMethod`
- مدخلات اشتقاق Terminal Value وفترتها
- `cash` و`debt` و`dilutedShares`

قواعد إضافية:

- FCFF يستخدم WACC ثم يضيف النقد ويطرح الدين مرة واحدة.
- FCFE يمثل تدفق حقوق الملكية؛ لذلك لا يجوز تكرار جسر النقد/الدين.
- `PERPETUITY_GROWTH` يعيد اشتقاق القيمة النهائية ويشترط نموًا نهائيًا أدنى من معدل الخصم.
- `EXIT_MULTIPLE` يعيد الاشتقاق من `terminalMetric × terminalExitMultiple`.
- `NONE` مقبول فقط عندما تكون Terminal Value صفرًا.
- فترة خصم تساوي صفرًا مسموحة لجسر time-zero الموثق؛ الفترات السالبة ممنوعة.
- `discountPeriods` متزايدة دون تكرار و`terminalDiscountPeriod` يساوي آخر فترة. الصفر يتطلب `timeZeroReason` للحالة Verified.
- `valuationDate` تاريخ صالح مطابق لـ`reportIdentity.analysisDate`؛ وإلا يلزم إعادة تأريخ النموذج أو مراجعة بشرية.
- `forecastPeriods` مصفوفة موازية للتدفقات تربط كل تدفق بسطر `yearlyForecast`. يجب أن يتطابق FCF بعد تحويل الوحدات؛ الاختلاف يتطلب `cashFlowReconciliation: [{period, adjustment, reason}]` بوحدة التدفق. لا يعد وجود معادلة صحيحة وحده إثباتًا لصحة التوقع الاقتصادي.
- `EXIT_MULTIPLE` يتطلب `terminalMetricType` متوافقًا مع نوع التدفق: EBITDA/EBIT/FCFF/REVENUE لقيمة المنشأة، وNET_INCOME/FCFE لحقوق الملكية.
- قيم النقد والدين الإجمالية غير سالبة، والتدفق المستدام في Gordon موجب مع نمو أكبر من ‎−100% وأقل من معدل الخصم. تجاوز السعة العددية يمنع التحقق.
- ارتفاع مساهمة Terminal Value فوق 75% يولد تحذيرًا واضحًا، ولا يعد خطأً تلقائيًا.

## 7. العلاقات المالية والملاءمة

- يعيد Franklin حساب هوامش EBITDA وFCF من الإيراد والمبالغ المتوقعة ويمنع التعارض المادي.
- يجب أن يرتبط EPS المستخدم في P/E بسجل توقع أو تطبيع مالي، وإلا يصعد للمراجعة.
- تكون `financialNormalization` مطلوبة عندما تحتاجها الطرق المختارة.
- P/E السالب الناتج من ربح سالب ومضاعف سالب محظور.
- EV/EBITDA يحتاج EBITDA ومضاعفًا وأسهمًا موجبة.
- طرق قيمة المنشأة للبنوك وشركات التأمين تتطلب استثناء اقتصاديًا صريحًا.
- استخدام P/E في REIT يتطلب مصالحة FFO/AFFO صريحة.

## 8. الحقول التفسيرية المطلوبة لـVerified

- `valuation.methodology.selectionReason`
- `valuation.methodology.weightReasoning`
- `valuation.valuationResults[].rationale`
- `valuation.valuationResults[].assumptions`
- `valuation.methodology.excludedMethods[]` مع `method` و`reason`

تعرض الواجهة سبب كل طريقة ووزنها وسبب الأوزان والطرق المستبعدة.

## 9. provenance والمصادر

كل مدخل تقييم جوهري يحتاج `inputProvenance` يحتوي:

- `sourceId` أو `type = ANALYST_ASSUMPTION`
- `asOf`
- `unit`
- `period`

كل رقم جوهري في `yearlyForecast` يحتاج `basis` و`asOf` و`unit` وفترة الصف، ويحتاج `sourceId` إلا إذا كان `basis = analyst_assumption`. أي `sourceId` يجب أن يطابق سجلًا موجودًا في `sources[]`.

يجب أن يكون `asOf` تاريخًا صالحًا ولا يتجاوز تاريخ التقرير. الوحدات أبعاد حسابية وليست نصًا شكليًا: جميع مبالغ التقييم والأسهم تستخدم مقياسًا متوافقًا (مثل USD million مع million shares)، وEPS بصيغة USD/share والمضاعفات x والنسب % وفترات الخصم years. الوحدات غير المعروفة تحتاج مراجعة؛ خلط العملة أو المقياس يمنع الاعتماد. تحوَّل المقاييس المعروفة عند مقارنة هوامش التوقع، ولا تحوَّل المدخلات الخام للتقييم بصمت.

يفصل Franklin بين ثلاث طبقات:

1. `presence`: وجود سجلات مصادر.
2. `linkage`: اكتمال الربط المعلن بين الرقم ومصدره/افتراض المحلل.
3. `externalVerification`: فحص المصدر خارجيًا للتأكد أن الصفحة تحتوي الرقم.

المسار الحالي يحدد الطبقة الثالثة دائمًا `NOT_PERFORMED`. لا يجوز للواجهة أو التقرير الادعاء بخلاف ذلك.

## 10. القرار ودرجات الثقة

- BUY/ADD بلا upside إلى Base يحتاج استثناء صريحًا قابلًا للمراجعة؛ وإلا يكون Blocked.
- SELL/REDUCE مع upside موجب يحتاج استثناء مماثل.
- الاستثناء المخالف لاتجاه Base يصنَّف Needs Review، ولا يكفي وجود أي نص في exceptionalReason لمنح Verified.
- يكتشف Franklin التناقضات بين النص والأرقام، مثل وصف السعر بأنه أدنى من Base بينما هو أعلى.
- درجات النموذج محفوظة في `modelReportedConfidence` و`modelReportedDataQuality` للتدقيق فقط.
- درجة Confidence المعروضة مشتقة من الحالة: Verified=90، Needs Review=60، Insufficient Data=30، Blocked=0.
- Data Quality المعروضة هي نسبة اكتمال provenance للمدخلات الجوهرية، وليست درجة يقررها النموذج.

## 11. التوافق والترحيل

- يبقى Schema V3 قابلًا لاستيراد الملفات القديمة بنيويًا.
- ينتقل `calculation.nonOperatingAdjustments` القديم إلى `inputs.nonOperatingAdjustments` عند غياب الحقل الحديث.
- إذا وُجد الحقلان بقيمتين مختلفتين تكون النتيجة Blocked.
- الملفات القديمة الناقصة لحقول الاكتمال أو provenance لا تُعد Verified؛ تنتقل إلى الحالة المناسبة مع أسباب قابلة للتصرف.

## 12. مقياس العرض

جميع درجات تقييم الشركة تستخدم مقياس 0–100 رقمًا وشريطًا ولونًا، وتعرض `/100`. القيم المرجعية 0 و55 و72 و82 و100 مختبرة. لا يجوز عرض عبارة «تحليل كامل» بدل حالة التحقق المالي.

## 13. إعادة التحقق بعد الحفظ

لا تعد `metadata.financialVerification` شهادة موثوقة. تعيد الواجهة تشغيل المدقق البنيوي والمالي على `metadata.franklinV3Report` باستخدام الكود الحالي. إذا غاب النموذج الأصلي، تكون الحالة Needs Review حتى لو احتوت البيانات المستوردة على شارة VERIFIED. الدرجات المشتقة مؤشرات اكتمال/تحقق وليست احتمال تحقيق عائد أو ضمان صحة افتراضات المحلل.
