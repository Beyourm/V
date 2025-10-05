// Offer.js - الإصدار النهائي الموحد بعد إصلاح جميع الأخطاء

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweX983lj4xsTDLo6C64usEcnbFmLST2aQ4v79zjKgIv2v5zGAJERurt_eLXf58dZhtIw/exec'; 
const INSTITUTION_WHATSAPP_NUMBER = '967778185189';

document.addEventListener('DOMContentLoaded', () => {
    // 1. تحديد العناصر (Selectors)
    const form = document.getElementById('registrationForm');
    const coursesListContainer = document.getElementById('coursesList');
    const statusDisplay = document.getElementById('selectionStatus');
    const submissionMessage = document.getElementById('submissionMessage');
    const submitButton = document.getElementById('submitButton');
    const countrySelect = document.getElementById('country'); 
    const loadingIndicator = document.getElementById('loadingIndicator');

    const MIN_SELECTION = 2; // الحد الأدنى لاختيار الدورات
    let courseCheckboxes; // لتخزين جميع Checkboxes بعد التوليد

    // 2. دوال مساعدة وإدارية
    
    /**
     * يبني رسالة الواتساب النهائية بعد نجاح الإرسال.
     */
    const buildWhatsappURL = (dataObj, coursesString, coursesCount) => {
        let messageBody = `مرحباً مؤسسة كن أنت، أرجو تأكيد اشتراكي في عرض VIP. هذه بيانات التسجيل المرسلة عبر النموذج:`;

        for (const [key, value] of Object.entries(dataObj)) {
            messageBody += `\n* ${key}: ${value}`;
        }
        
        messageBody += `\n* الدورات المختارة (${coursesCount}): ${coursesString}`;
        
        const encodedMessage = encodeURIComponent(messageBody);
        
        return `https://wa.me/${INSTITUTION_WHATSAPP_NUMBER}?text=${encodedMessage}`;
    };

    /**
     * يملأ القائمة المنسدلة للبلدان.
     */
    const populateCountries = () => {
        // 🛑🛑 تم التعديل هنا للوصول الآمن للمصفوفة العالمية دون إحداث تعارض (حماية الصفحات الأخرى)
        const countriesList = typeof arabCountries !== 'undefined' ? arabCountries : null;

        if (countriesList && Array.isArray(countriesList)) {
            countriesList.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countrySelect.appendChild(option);
            });
        } else {
             console.error("❌ فشل: مصفوفة البلدان (arabCountries) غير مُعرفة أو فارغة. تأكد من تحميل js/countries.js أولاً.");
        }
    };


    /**
     * يجلب قائمة الدورات من Google Sheet ويولد عناصر HTML.
     */
    const generateCoursesList = async () => { // 🛑 تم إصلاح التكرار هنا
        
    // 1. تعريف المتغيرات باستخدام رابط النشر (الطريقة الأكثر استقراراً)
    const PUBLISHED_SHEET_ID = '2PACX-1vR0xJG_95MQb1Dwqzg0Ath0_5RIyqdEoHJIW35rBnW8qy17roXq7-xqyCPZmGx2n3e1aj4jY1zkbRa-';
    const GID = '1511305260'; // معرّف تبويبة الورقة

    // الرابط النهائي لجلب بيانات CSV
    const COURSES_API_URL =
            `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub?gid=${GID}&single=true&output=csv`;

    coursesListContainer.innerHTML = '<div class="loading-courses">جاري تحميل الدورات... <i class="fa-solid fa-spinner fa-spin"></i></div>';
    submitButton.disabled = true;

    try {
        console.log("1. جاري بدء جلب البيانات من:", COURSES_API_URL);

        // 2. الجلب من رابط CSV
        const response = await fetch(COURSES_API_URL); 
        const text = await response.text();
        
        console.log("2. نجاح الجلب. حجم النص (أول 100 حرف):", text.substring(0, 100)); // تحقق من محتوى النص

        // 3. معالجة بيانات CSV
        const rows = text.split('\n');
        
        if (rows.length < 2) {
             coursesListContainer.innerHTML = '<p class="error-message status-error">⚠️ لم يتم العثور على بيانات في ورقة "بيانات_الدورات".</p>';
             return;
        }

        // الصف الأول هو رؤوس الأعمدة
        const headers = rows[0].split(',').map(header => header.trim().replace(/"/g, ''));
        const requiredColumns = ['id', 'title', 'heroDescription', 'is_vip']; 
        
        console.log("3. الرؤوس المُستخلصة من CSV:", headers);
        
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
             coursesListContainer.innerHTML = `<p class="error-message status-error">❌ خطأ: لم يتم العثور على الأعمدة المطلوبة في الصف الأول: <b>${missingColumns.join(', ')}</b>.</p>`;
             return;
        }
        
        console.log("4. جميع الأعمدة المطلوبة موجودة. بدء الفلترة...");

        const coursesMatrix = [];
        for (let i = 1; i < rows.length; i++) {
            // تقسيم حسب الفاصلة مع تجاهل الفواصل داخل علامات التنصيص
            const rowValues = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
            const course = {};
            let is_vip_match = false;
            
            for (let j = 0; j < headers.length; j++) {
                const colName = headers[j];
                let value = rowValues[j] ? rowValues[j].trim().replace(/"/g, '') : '';
                
                course[colName] = value;
                
                // 🛑 الفلترة المُحسَّنة: نبحث عن 'Y' أو 'y' في عمود is_vip
                if (colName === 'is_vip' && value.toUpperCase() === 'Y') {
                    is_vip_match = true;
                }
            }
            
            // 🛑 إضافة الدورة فقط إذا كانت VIP وصالحة
            if (is_vip_match && course.id && course.title) {
                coursesMatrix.push(course);
                console.log(`✅ تم قبول الدورة: ${course.title} (VIP: ${course.is_vip})`);
            } else if (course.title) {
                console.log(`❌ تم رفض الدورة: ${course.title} (VIP: ${course.is_vip}). السبب: إما أنها ليست VIP أو البيانات غير كاملة.`);
            }
        }
        
        console.log(`5. عملية الفلترة انتهت. عدد الدورات الجاهزة للعرض: ${coursesMatrix.length}`);

        // 6. توليد عناصر الـ Checkboxes
        coursesListContainer.innerHTML = '';
        if (coursesMatrix.length > 0) {
            coursesMatrix.forEach(course => {
                const label = document.createElement('label');
                label.classList.add('course-item');
                label.innerHTML = `
                    <input type="checkbox" name="courses_selected" value="${course.title}" aria-label="${course.title}">
                    <span class="custom-checkbox"></span>
                    <span class="course-title"><i class="fa-solid fa-circle-check"></i> ${course.title}</span>
                    <span class="course-description">${course.heroDescription || ''}</span>
                `;
                coursesListContainer.appendChild(label);
            });
            
            // 7. ربط الأحداث وتحديث الحالة
            courseCheckboxes = coursesListContainer.querySelectorAll('input[type="checkbox"]');
            courseCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', handleCourseChange);
            });
            updateSelectionStatus();
            console.log("6. تم توليد عناصر الدورات بنجاح.");

        } else {
             coursesListContainer.innerHTML = '<p class="error-message status-error">⚠️ لم يتم العثور على دورات VIP. (تأكد من وجود قيمة **Y** في عمود is_vip).</p>';
             console.log("6. لم يتم توليد أي دورات.");
        }

    } catch (error) {
        console.error('❌ خطأ فادح في generateCoursesList:', error);
        coursesListContainer.innerHTML = '<p class="error-message status-error">❌ فشل غير متوقع. (حدث خطأ أثناء معالجة البيانات).</p>';
    } finally {
        if (coursesListContainer.children.length === 0 || (typeof coursesMatrix !== 'undefined' && coursesMatrix.length === 0)) {
            submitButton.disabled = true;
        } else {
            submitButton.disabled = true;
        }
    }
};

    // 3. دوال التحقق المتقدم (Validation) 
    
    const displayFieldError = (inputElement, message) => {
        const errorElement = document.getElementById(inputElement.id + 'Error');
        if (!errorElement) return;
        if (message) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            inputElement.classList.add('input-error');
        } else {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
            inputElement.classList.remove('input-error');
        }
    };
    const validateField = (input) => {
        const value = input.value.trim();
        let message = '';
        if (input.hasAttribute('required') && (value === '' || (input.tagName.toLowerCase() === 'select' && input.value === ''))) {
            message = 'هذا الحقل مطلوب ولا يمكن تركه فارغاً.';
        } else {
            switch (input.id) {
                case 'email':
                    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'يرجى إدخال بريد إلكتروني صحيح.';
                    break;
                case 'phone':
                    const phoneSanitized = value.replace(/[\s\-\(\)]/g, '');
                    if (phoneSanitized.length > 0 && phoneSanitized.length < 8) message = 'يرجى إدخال رقم هاتف لا يقل عن 8 أرقام.';
                    break;
                case 'age':
                    const age = parseInt(value);
                    if (value && (isNaN(age) || age < 18 || age > 99)) message = 'يجب أن يكون العمر بين 18 و 99.';
                    break;
            }
        }
        displayFieldError(input, message);
        return !message;
    };
    
    // 🛑 تحديث: تم تبسيط عملية التحقق وتفعيل الزر
    const validateForm = () => {
        let isFormValid = true;
        // 1. التحقق من الحقول الفردية
        form.querySelectorAll('[required]').forEach(input => {
            if (!validateField(input)) isFormValid = false;
        });
        // 2. التحقق من الدورات
        // 💡 نتحقق فقط إذا كانت الدورات موجودة للتحقق
        if (courseCheckboxes && courseCheckboxes.length > 0) {
            if (!updateSelectionStatus(false)) isFormValid = false; 
        } else {
            // إذا لم تظهر الدورات (فشل الجلب)، لا يمكن تفعيل الزر أبداً.
            isFormValid = false;
        }
        
        // تفعيل أو تعطيل الزر بناءً على صحة النموذج بالكامل
        if (isFormValid) {
            submitButton.classList.add('ready-to-submit');
            submitButton.disabled = false;
        } else {
            submitButton.classList.remove('ready-to-submit');
            submitButton.disabled = true;
        }
        
        return isFormValid;
    };
    
    // 4. دوال التفاعل مع الدورات والحالة
    const handleCourseChange = (e) => {
        e.target.closest('.course-item').classList.toggle('is-selected', e.target.checked);
        updateSelectionStatus();
    };
    
    // 🛑 تحديث: تم تبسيط عملية التحقق من حالة الاختيار
    const updateSelectionStatus = (updateValidation = true) => {
        if (!courseCheckboxes) return false;
        const checkedCount = Array.from(courseCheckboxes).filter(cb => cb.checked).length;
        const coursesErrorElement = document.getElementById('coursesError');
        coursesErrorElement.style.display = 'none';

        if (checkedCount < MIN_SELECTION) {
            statusDisplay.classList.add('status-error');
            statusDisplay.classList.remove('status-success');
            let message = (checkedCount === 0) 
                ? 'يجب اختيار دورتين على الأقل. لم يتم اختيار أي دورة حتى الآن.'
                : `يجب اختيار دورتين على الأقل. اختر ${MIN_SELECTION - checkedCount} دورة إضافية.`;
            statusDisplay.textContent = message;
            coursesErrorElement.textContent = (checkedCount === 0) ? 'الرجاء اختيار دورتين على الأقل.' : `تحتاج لاختيار ${MIN_SELECTION - checkedCount} دورة إضافية.`;
            coursesErrorElement.style.display = 'block';
            
            // نطلب إعادة التحقق من الفورم بعد تغيير الاختيار
            if (updateValidation) validateForm();
            return false;
        } else {
            statusDisplay.classList.remove('status-error');
            statusDisplay.classList.add('status-success');
            statusDisplay.textContent = `اختيار موفق! تم اختيار ${checkedCount} دورة. أكمل بيانات التسجيل وأرسلها.`;
            
            // نطلب إعادة التحقق من الفورم بعد تغيير الاختيار
            if (updateValidation) validateForm();
            return true;
        }
    };
    
    // 5. منطق الإرسال الرئيسي (Submission)
    form.addEventListener('submit', async function(e) {
        e.preventDefault(); 
        // 🛑 نستخدم validateForm للتأكد من حالة الزر قبل الإرسال
        if (!validateForm()) return; 

        submitButton.textContent = 'جاري إرسال البيانات...';
        submitButton.disabled = true;
        loadingIndicator.style.display = 'flex'; // تفعيل المؤشر
        submissionMessage.style.display = 'none';

        const formData = new FormData(this);
        const urlParams = new URLSearchParams(formData); 
        const selectedCourseElements = Array.from(courseCheckboxes).filter(cb => cb.checked);
        const coursesString = [];
        
        const allFields = {
            'الاسم الكامل': formData.get('الاسم الكامل'),
            'البريد الإلكتروني': formData.get('البريد الإلكتروني'),
            'رقم الهاتف': formData.get('رقم الهاتف'),
            'العمر': formData.get('العمر'),
            'الجنس': formData.get('الجنس'),
            'البلد': formData.get('البلد'), 
            'ملاحظات إضافية': formData.get('ملاحظات إضافية') || 'لا توجد',
        };
        selectedCourseElements.forEach(checkbox => coursesString.push(checkbox.value));
        const coursesStringJoined = coursesString.join('، '); 

        try {
            // 🛑 الإرسال لجدول Google Sheet (عبر GOOGLE_SCRIPT_URL)
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: urlParams
            });

            // 🛑 طباعة الرد النصي أولًا
            const resultText = await response.text();
            console.log("🔎 رد السيرفر:", resultText);

            // 🛑 محاولة تحليل الـ JSON بأمان
            let result;
            try {
                // نتحقق من أن الرد يحتوي على JSON فعلاً قبل محاولة التحليل
                if (resultText && resultText.trim().startsWith('{')) {
                    result = JSON.parse(resultText);
                } else {
                    // إذا لم يكن الرد JSON، ولكن حالة السيرفر ناجحة، نفترض النجاح
                    if (response.status >= 200 && response.status < 300) {
                        result = { success: true, message: "تم افتراض النجاح بناءً على Status 200." };
                    } else {
                         throw new Error(`فشل الإرسال: الرد غير صالح وحالة السيرفر هي: ${response.status}`);
                    }
                }
            } catch(e) {
                 throw new Error("فشل تحليل الرد من السيرفر. (الرجاء التحقق من نشر Google Script)");
            }

            // 🛑 التحقق من خاصية النجاح (success) في الرد
            if (!result.success) {
                throw new Error(result.message || "خطأ أثناء إرسال البيانات: عملية Script فشلت");
            }
            
            // ✅ النجاح
            const whatsappURL = buildWhatsappURL(allFields, coursesStringJoined, coursesString.length);

            let countdown = 3;
            const timer = setInterval(() => {
                submissionMessage.textContent = `✅ تم تسجيل بياناتك بنجاح! جارٍ توجيهك خلال ${countdown}...`;
                submissionMessage.classList.add('status-success');
                submissionMessage.classList.remove('status-error');
                submissionMessage.style.display = 'block';
                countdown--;
                if (countdown < 0) {
                    clearInterval(timer);
                    window.location.href = whatsappURL;
                }
            }, 1000);

        } catch (error) {
            // 🛑 معالجة الأخطاء النهائية: إظهار رسالة الفشل فقط
            submissionMessage.classList.remove('status-success');
            submissionMessage.classList.add('status-error');
            submissionMessage.textContent = '❌ حدث خطأ أثناء إرسال البيانات. الرجاء المحاولة مرة أخرى.';
            submissionMessage.style.display = 'block';
            
            // لا نضع هنا أي كود لاستعادة الزر! نعتمد على finally
            console.error('خطأ في الإرسال:', error.message);
        } finally {
            // 🛑 🛑 كتلة finally مسؤولة عن كل أعمال التنظيف 🛑 🛑
            submitButton.textContent = 'إرسال التسجيل الآن'; // استعادة نص الزر
            submitButton.disabled = false; 
            submitButton.classList.remove('ready-to-submit'); 
            loadingIndicator.style.display = 'none'; // إخفاء المؤشر (الأهم)
            
            // 💡 إعادة التحقق لتحديد الحالة النهائية للزر بعد محاولة الإرسال
            validateForm(); 
        }
    });
    
    
    
    
    
    // 6. تهيئة الصفحة
    form.querySelectorAll('[required]').forEach(input => {
        input.addEventListener('input', validateForm); // ربط التغيير في الحقول بالتحقق
        if (input.tagName.toLowerCase() === 'select') {
            input.addEventListener('change', validateForm); // ربط التغيير في القائمة المنسدلة بالتحقق
        }
    });

    // 🛑🛑 هذا هو السطر المفقود الذي يجب إضافته 🛑🛑
    populateCountries(); 
    
    generateCoursesList(); 
});
