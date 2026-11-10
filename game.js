const jobsList = [
    { id: 1, title: "رحلة العاصمة", route: "طنطا ⬅️ القاهرة (رمسيس)", train: "قطار إسباني مكيف", req: "الالتزام بالمواعيد والوقوف في بنها", reward: "500 ج.م" },
    { id: 2, title: "سرفيس الدلتا السريع", route: "طنطا ⬅️ الإسكندرية", train: "قطار روسي تهوية", req: "خدمة ركاب كفر الزيات ودمنهور", reward: "450 ج.م" },
    { id: 3, title: "نقل فوسفات الدلتا", route: "طنطا ⬅️ ميناء الإسكندرية", train: "جرار كندي أزرق", req: "حمولة ثقيلة 70 طن - فرملة مبكرة", reward: "800 ج.م" },
    { id: 4, title: "خط عروس البحر", route: "طنطا ⬅️ مرسى مطروح", train: "قطار نوم / روسي مكيف", req: "رحلة طويلة - الحفاظ على السرعة 100 كم/س", reward: "1,200 ج.م" },
    { id: 5, title: "قطار القناة", route: "طنطا ⬅️ الإسماعيلية", train: "قطار محسن/مجاري", req: "المرور بمحطات الزقازيق وأبو حماد", reward: "400 ج.م" },
    { id: 6, title: "شحنة البترول السريعة", route: "طنطا ⬅️ السويس", train: "قطار صهاريج (جرار GE)", req: "تجنب السرعة الزائدة في الانحناءات", reward: "900 ج.م" },
    { id: 7, title: "رحلة المنصورة", route: "طنطا ⬅️ المنصورة", train: "قطار ضواحي (سرفيس)", req: "التوقف في كل المحطات الفرعية", reward: "350 ج.م" },
    { id: 8, title: "نقل الغلال والحبوب", route: "طنطا ⬅️ دمياط (الميناء)", train: "قطار بضائع مختلطة", req: "نقل شحنة قمح ووصولها في الوقت المحدد", reward: "750 ج.م" },
    { id: 9, title: "قطار التوربيني الصباحي", route: "القاهرة ⬅️ طنطا", train: "قطار توربيني فاخر", req: "تسارع عالي والالتزام بحد السرعة 120 كم/س", reward: "600 ج.م" },
    { id: 10, title: "مظاليم الدلتا", route: "الإسكندرية ⬅️ طنطا", train: "قطار ثالثة عادية", req: "محاكاة الزحام وتأمين فتح وغلق الأبواب", reward: "400 ج.م" }
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
    setTimeout(() => {
        document.getElementById("passenger-modal").classList.remove("hidden");
    }, 1500);
}

function returnToMenu() {
    document.getElementById("game-screen").classList.remove("active");
    document.getElementById("main-menu").classList.add("active");
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
    startGame();
}

function toggleDoors() {
    doorsOpen = !doorsOpen;
    document.getElementById("door-state").innerText = doorsOpen ? "(مفتوحة)" : "(مقفولة)";
    alert(doorsOpen ? "تم فتح أبواب القطار لصعود ونزول الركاب." : "تم إغلاق الأبواب تماماً.");
}

function playHorn() {
    alert("🎺 بيييييب! صوت كلاكس القطار المصري.");
}

function useSand() {
    alert("⏳ تم رش الرمل على قضبان السكة.");
}

function emergencyBrake() {
    currentSpeed = 0;
    document.getElementById("brake-lever").value = 100;
    document.getElementById("throttle-lever").value = 0;
    document.getElementById("speed-num").innerText = "0";
    alert("🚨 فرملة طوارئ! توقف القطار.");
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
        alert("⚠️ تحذير: الأبواب مفتوحة! اغلق الأبواب أولاً.");
        document.getElementById("throttle-lever").value = 0;
        return;
    }
    if (brakeVal < 50) {
        currentSpeed = Math.min(140, Math.floor(val * 1.4));
        document.getElementById("speed-num").innerText = currentSpeed;
    }
}

function buyTrain(trainName) {
    alert("برجاء تحويل 40 ج.م عبر فودافون كاش للرقم 01093706503 لتفعيل " + trainName + " فوراً.");
}
