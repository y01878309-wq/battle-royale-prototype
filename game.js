// قائمة الـ 30 مهمة للقطارات المصرية
const jobsList = [
    { id: 1, title: "رحلة العاصمة", route: "طنطا ⬅️ القاهرة (رمسيس)", train: "قطار إسباني مكيف", req: "الالتزام بالمواعيد والوقوف في بنها فقط", reward: "500 ج.م" },
    { id: 2, title: "سرفيس الدلتا السريع", route: "طنطا ⬅️ الإسكندرية", train: "قطار روسي تهوية", req: "خدمة ركاب كفر الزيات ودمنهور", reward: "450 ج.م" },
    { id: 3, title: "نقل فوسفات الدلتا", route: "طنطا ⬅️ ميناء الإسكندرية", train: "جرار كندي أزرق", req: "حمولة ثقيلة 70 طن - فرملة مبكرة", reward: "800 ج.م" },
    { id: 4, title: "خط عروس البحر", route: "طنطا ⬅️ مرسى مطروح", train: "قطار نوم / روسي مكيف", req: "رحلة طويلة - الحفاظ على السرعة 100 كم/س", reward: "1,200 ج.م" },
    { id: 5, title: "قطار القناة", route: "طنطا ⬅️ الإسماعيلية", train: "قطار محسن/مجاري", req: "المرور بمحطات الزقازيق وأبو حماد", reward: "400 ج.م" },
    { id: 6, title: "شحنة البترول السريعة", route: "طنطا ⬅️ السويس", train: "قطار صهاريج (جرار GE)", req: "تجنب السرعة الزائدة في الانحناءات", reward: "900 ج.م" },
    { id: 7, title: "رحلة المنصورة", route: "طنطا ⬅️ المنصورة", train: "قطار ضواحي (سرفيس)", req: "التوقف في كل المحطات الفرعية", reward: "350 ج.م" },
    { id: 8, title: "نقل الغلال والحبوب", route: "طنطا ⬅️ دمياط (الميناء)", train: "قطار بضائع مختلطة", req: "نقل شحنة قمح ووصولها في الوقت المحدد", reward: "750 ج.م" },
    { id: 9, title: "قطار التوربيني الصباحي", route: "القاهرة ⬅️ طنطا", train: "قطار توربيني فاخر", req: "تسارع عالي والالتزام بحد السرعة 120 كم/س", reward: "600 ج.م" },
    { id: 10, title: "مظاليم الدلتا", route: "الإسكندرية ⬅️ طنطا", train: "قطار ثالثة عادية", req: "محاكاة الزحام وتأمين فتح وغلق الأبواب", reward: "400 ج.م" },
    { id: 11, title: "رحلة قطار التالجو الفاخر", route: "القاهرة ⬅️ أسيوط", train: "قطار تالجو (PRL أمريكي)", req: "قيادة سلسة ومريحة بدون فرملة مفاجئة", reward: "1,500 ج.م" },
    { id: 12, title: "قطار الصعيد السريع", route: "القاهرة ⬅️ أسوان", train: "قطار إسباني VIP", req: "رحلة كاملة تمر ببني سويف والمنيا والأقصر", reward: "2,500 ج.م" },
    { id: 13, title: "شحنة أبو طرطور", route: "الواحات ⬅️ سفاجا", train: "قطار فوسفات (82 طن)", req: "أثقل حمولة في اللعبة - قيادة بحذر شديد", reward: "3,000 ج.م" },
    { id: 14, title: "سرفيس عروس الصعيد", route: "بني سويف ⬅️ المنيا", train: "قطار روسي تهوية", req: "فتح الأبواب للركاب والمغادرة بعد العداد", reward: "500 ج.م" },
    { id: 15, title: "قطار النوبة الصباحي", route: "الأقصر ⬅️ أسوان", train: "قطار نوم فاخر", req: "تجنب تجاوز إشارات السكة الحديد", reward: "1,000 ج.م" },
    { id: 16, title: "نقل حديد ومواد بناء", route: "الجيزة ⬅️ أسيوط", train: "قطار بضائع مفتوح", req: "الحفاظ على ثبات الشحنة ومنع الاهتزاز", reward: "1,200 ج.م" },
    { id: 17, title: "رحلة وادي النيل", route: "أسيوط ⬅️ سوهاج", train: "قطار مكيف عادي", req: "الالتزام بالوقوف في محطات طما والرقاب", reward: "650 ج.م" },
    { id: 18, title: "قطار السكر والقصب", route: "قنا ⬅️ نجع حمادي", train: "قطار بضائع ريفي", req: "نقل محاصيل السكر إلى المصانع", reward: "850 ج.م" },
    { id: 19, title: "شحن السخنة السريع", route: "العين السخنة ⬅️ سوهاج", train: "قطار حاويات ومينا", req: "رحلة ربط البحر الأحمر بالصعيد", reward: "1,800 ج.م" },
    { id: 20, title: "القطار الروسي الصعيدي", route: "القاهرة ⬅️ سوهاج", train: "قطار روسي جديد", req: "الحفاظ على وقت الوصول الدقيق", reward: "1,100 ج.م" },
    { id: 21, title: "تحدي طوارئ الطقس", route: "طنطا ⬅️ بنها", train: "قطار مكيف (في الشبورة)", req: "الرؤية منخفضة - الاعتماد على الإشارات", reward: "900 ج.م" },
    { id: 22, title: "خط الساحل السريع", route: "مرسى مطروح ⬅️ الإسكندرية", train: "قطار مكيف موسم الصيف", req: "الازدحام العالي والتوقف في العالمين", reward: "1,300 ج.م" },
    { id: 23, title: "إسعاف وتجديد السكة", route: "القاهرة ⬅️ طنطا", train: "جرار صيانة (أدترانز ألماني)", req: "الوصول لسكة عطلانة وتصليح الخط", reward: "1,000 ج.م" },
    { id: 24, title: "مونوريل العاصمة", route: "العاصمة الإدارية ⬅️ مدينة نصر", train: "مونوريل القاهرة", req: "سرعة وتوقف تلقائي دقيق في المحطات", reward: "700 ج.م" },
    { id: 25, title: "نقل الحاويات والميناء", route: "بورسعيد ⬅️ القاهرة", train: "قطار حاويات عالمية", req: "نقل شحنات الموانئ بسرعة وسلامة", reward: "1,400 ج.م" },
    { id: 26, title: "المترو السريع", route: "المرج ⬅️ حلوان", train: "خط المترو الأول", req: "محاكاة زحام المترو والتوقف 30 ثانية", reward: "600 ج.م" },
    { id: 27, title: "قطار المفاجآت (VIP)", route: "طنطا ⬅️ الأقصر", train: "قطار فاخر", req: "رحلة طويلة جداً بدون أي خطأ في السرعة", reward: "3,500 ج.م" },
    { id: 28, title: "شحن الرخام والأحجار", route: "الجلالة ⬅️ القاهرة", train: "قطار بضائع ثقيلة", req: "الانحدارات الجبلية والفرملة بالهواء", reward: "1,600 ج.م" },
    { id: 29, title: "تحدي الـ 100 كم/س", route: "بنها ⬅️ طنطا", train: "أي جرار خفيف", req: "تثبيت السرعة على 100 كم/س بالضبط", reward: "800 ج.م" },
    { id: 30, title: "بطولة السائق الذهبي", route: "القاهرة ⬅️ أسوان (كامل)", train: "الجرار الجنرال GE", req: "إتمام الخط بالكامل دون مخالفة إشارة", reward: "5,000 ج.م" }
];

let doorsOpen = false;
let currentSpeed = 0;
let brakeVal = 0;
let throttleVal = 0;

document.addEventListener("DOMContentLoaded", () => {
    renderJobs();
});

function startGame() {
    document.getElementById("main-menu").classList.remove("active");
    document.getElementById("game-screen").classList.add("active");
    
    // محاكاة توقف المحطة الأولى
    setTimeout(() => {
        document.getElementById("passenger-modal").classList.remove("hidden");
    }, 1500);
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}

function renderJobs() {
    const container = document.getElementById("jobs-container");
    container.innerHTML = "";
    jobsList.forEach(job => {
        const item = document.createElement("div");
        item.className = "job-item";
        item.innerHTML = `
            <div class="job-info">
                <h4>#${job.id} - ${job.title} (${job.reward})</h4>
                <p><strong>الخط:</strong> ${job.route} | <strong>القطار:</strong> ${job.train}</p>
                <p><strong>المطلوب:</strong> ${job.req}</p>
            </div>
            <button class="btn btn-primary" onclick="selectJob(${job.id})">ابدأ المهمة</button>
        `;
        container.appendChild(item);
    });
}

function selectJob(id) {
    closeModal("jobs-modal");
    alert("تم اختيار المهمة رقم " + id + "! استعد للانطلاق من المحطة.");
    startGame();
}

function toggleDoors() {
    doorsOpen = !doorsOpen;
    const doorStateStr = doorsOpen ? "(مفتوحة)" : "(مقفولة)";
    document.getElementById("door-state").innerText = doorStateStr;
    alert(doorsOpen ? "تم فتح أبواب القطار للركاب." : "تم إغلاق أبواب القطار بأمان.");
}

function playHorn() {
    alert("🎺 صوت بوق / كلاكس القطار المصري (بيييب بييييب)!");
}

function useSand() {
    alert("⏳ تم رش الرمل على القضبان لتزيد الاحتكاك وتمنع الانزلاق.");
}

function emergencyBrake() {
    currentSpeed = 0;
    document.getElementById("brake-lever").value = 100;
    document.getElementById("throttle-lever").value = 0;
    document.getElementById("speed-num").innerText = "0";
    alert("🚨 تم تشغيل فرملة الطوارئ للهواء! توقف القطار تماماً.");
}

function updateBrake(val) {
    brakeVal = val;
    if (brakeVal > 20 && currentSpeed > 0) {
        currentSpeed = Math.max(0, currentSpeed - Math.floor(brakeVal / 10));
        document.getElementById("speed-num").innerText = currentSpeed;
    }
}

function updateThrottle(val) {
    throttleVal = val;
    if (doorsOpen) {
        alert("⚠️ تحذير: لا يمكنك التحرك والأبواب مفتوحة! اغلق الأبواب أولاً.");
        document.getElementById("throttle-lever").value = 0;
        return;
    }
    if (brakeVal < 50) {
        currentSpeed = Math.min(120, Math.floor(val * 1.2));
        document.getElementById("speed-num").innerText = currentSpeed;
    }
}

function buyTrain(trainName) {
    alert("تم توجيه طلب الشراء لـ " + trainName + ". برجاء تحويل 40 ج.م عبر فودافون كاش أو إنستا باي للرقم 01065751305 لتفعيل القطر فوراً.");
}
