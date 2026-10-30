import { makeWASocket, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";
import figlet from "figlet";
import moment from "moment";
import fs from "fs";
import { startDashboardBridge } from "./dashboard_bridge.js"
import messageHandler from "./handlers/messageHandler.js";
import { getGroupConfig } from './moduls/config.js';
const logStream = fs.createWriteStream("bot.log", { flags: "a" })
import antiStatusMention from './lib/AntiStatus.js'
const origLog = console.log
import express from "express";
import qrcode from "qrcode"; 
import axios from "axios"; 
import { connectMongo } from "./mongo.js"
import { useMongoAuthState } from "./auth.js"
if (fs.existsSync('./bot/session')) {
    fs.rmSync('./bot/session', { recursive: true, force: true });
    console.log('🗑️ Folder sesi rusak berhasil dihapus otomatis oleh sistem!');
}

console.log = function (...args) {

    const text = args.join(" ")

    origLog(text)

    logStream.write(text + "\n")

}
// 🔧 Logger custom
const customLogger = pino({
    level: 'error',
    transport: {
        target: 'pino-pretty',
        options: { ignore: 'pid,hostname', colorize: true }
    }
});
// ======================
// Flag Bot aktif / tidak
// ======================
let sock = null
// ======================
// Flag Bot aktif / tidak
// ======================
global.BOT_ACTIVE = false; // bot awalnya mati
const STATUS_FILE = "bot_status.txt";
fs.writeFileSync(STATUS_FILE, global.BOT_ACTIVE ? "RUNNING" : "OFFLINE");
// ======================
// Cache group metadata
// ======================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const groupMetaCache = {};
const getGroupMetadataSafe = async (sock, jid) => {
    if (groupMetaCache[jid]) return groupMetaCache[jid];
    try {
        const metadata = await sock.groupMetadata(jid);
        groupMetaCache[jid] = metadata;
        setTimeout(() => delete groupMetaCache[jid], 5 * 60 * 1000);
        return metadata;
    } catch (err) {
        console.error(`❌ Gagal ambil metadata ${jid}:`, err.message || err);
        return null;
    }
};


// ------Hadith Sample------
const hadithList = [
    "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya. (HR. Ahmad)",
    "Sesungguhnya amal itu tergantung niatnya. (HR. Bukhari & Muslim)",
    "Senyummu kepada saudaramu adalah sedekah. (HR. Tirmidzi)",
    "Tidak sempurna iman seseorang hingga ia mencintai saudaranya seperti mencintai dirinya sendiri. (HR. Bukhari & Muslim)",
    "Sebaik-baik kalian adalah yang paling baik akhlaknya. (HR. Bukhari)",
    "Sedekah tidak akan mengurangi harta. (HR. Muslim)",
    "Barangsiapa menempuh jalan untuk mencari ilmu, Allah akan mudahkan baginya jalan menuju surga. (HR. Muslim)",
    "Orang yang penyayang akan disayangi oleh Yang Maha Penyayang. (HR. Tirmidzi)",
    "Permudahlah dan jangan mempersulit. (HR. Bukhari & Muslim)",
    "Barangsiapa beriman kepada Allah dan hari akhir hendaklah berkata baik atau diam. (HR. Bukhari & Muslim)",
    "Allah tidak melihat rupa kalian tetapi melihat hati kalian. (HR. Muslim)",
    "Tangan di atas lebih baik daripada tangan di bawah. (HR. Bukhari & Muslim)",
    "Doa adalah ibadah. (HR. Tirmidzi)",
    "Sebaik-baik kalian adalah yang belajar Al-Qur'an dan mengajarkannya. (HR. Bukhari)",
    "Orang kuat adalah yang mampu menahan amarahnya. (HR. Bukhari & Muslim)",
    "Barangsiapa memudahkan urusan orang lain, Allah akan memudahkan urusannya. (HR. Muslim)",
    "Jagalah Allah, niscaya Allah menjagamu. (HR. Tirmidzi)",
    "Dunia adalah penjara bagi orang mukmin dan surga bagi orang kafir. (HR. Muslim)",
    "Barangsiapa yang tidak bersyukur kepada manusia maka ia tidak bersyukur kepada Allah. (HR. Tirmidzi)",
    "Sesungguhnya Allah itu baik dan menyukai kebaikan. (HR. Muslim)",

    "Sesungguhnya orang mukmin itu bersaudara. (HR. Bukhari & Muslim)",
    "Sebaik-baik sedekah adalah memberi makan. (HR. Ahmad)",
    "Berikanlah kabar gembira dan jangan membuat orang lari. (HR. Bukhari & Muslim)",
    "Allah mencintai kelembutan dalam segala perkara. (HR. Bukhari & Muslim)",
    "Barangsiapa menutup aib seorang muslim, Allah akan menutup aibnya. (HR. Muslim)",
    "Sesungguhnya kejujuran membawa kepada kebaikan. (HR. Bukhari & Muslim)",
    "Kebohongan membawa kepada keburukan. (HR. Bukhari & Muslim)",
    "Seorang muslim adalah saudara bagi muslim lainnya. (HR. Bukhari & Muslim)",
    "Shalatlah kalian sebagaimana kalian melihat aku shalat. (HR. Bukhari)",
    "Sesungguhnya Allah Maha Lembut dan mencintai kelembutan. (HR. Muslim)",

    "Orang mukmin yang kuat lebih dicintai Allah daripada mukmin yang lemah. (HR. Muslim)",
    "Sebaik-baik manusia adalah yang paling baik kepada keluarganya. (HR. Tirmidzi)",
    "Saling memberi hadiah akan menumbuhkan cinta. (HR. Bukhari)",
    "Barangsiapa beriman kepada Allah dan hari akhir maka hendaklah memuliakan tamunya. (HR. Bukhari & Muslim)",
    "Barangsiapa beriman kepada Allah dan hari akhir maka hendaklah memuliakan tetangganya. (HR. Bukhari & Muslim)",
    "Sesungguhnya Allah mencintai orang yang sabar. (HR. Muslim)",
    "Barangsiapa bersabar maka Allah akan memberinya kesabaran. (HR. Bukhari)",
    "Janganlah marah. (HR. Bukhari)",
    "Senyuman kepada saudaramu adalah sedekah. (HR. Tirmidzi)",
    "Sesungguhnya Allah mencintai orang yang berbuat baik. (HR. Bukhari)",

    "Orang yang paling dekat denganku di hari kiamat adalah yang paling baik akhlaknya. (HR. Tirmidzi)",
    "Sesungguhnya agama itu mudah. (HR. Bukhari)",
    "Barangsiapa membantu saudaranya maka Allah akan membantunya. (HR. Muslim)",
    "Sesungguhnya Allah menyukai jika seseorang melakukan pekerjaan dengan baik. (HR. Baihaqi)",
    "Barangsiapa menempuh jalan mencari ilmu maka Allah mudahkan jalannya menuju surga. (HR. Muslim)",
    "Sesungguhnya doa adalah senjata orang mukmin. (HR. Hakim)",
    "Barangsiapa membaca satu huruf dari Al-Qur'an maka baginya satu kebaikan. (HR. Tirmidzi)",
    "Shalat berjamaah lebih utama daripada shalat sendirian. (HR. Bukhari & Muslim)",
    "Sesungguhnya orang yang paling aku cintai adalah yang paling baik akhlaknya. (HR. Tirmidzi)",
    "Sesungguhnya dunia itu manis dan hijau. (HR. Muslim)",

    "Berbaktilah kepada kedua orang tuamu. (HR. Bukhari)",
    "Ridha Allah tergantung pada ridha orang tua. (HR. Tirmidzi)",
    "Barangsiapa tidak menyayangi maka ia tidak akan disayangi. (HR. Bukhari & Muslim)",
    "Allah mencintai orang yang dermawan. (HR. Tirmidzi)",
    "Sesungguhnya Allah itu indah dan menyukai keindahan. (HR. Muslim)",
    "Orang mukmin tidak suka mencela. (HR. Tirmidzi)",
    "Orang mukmin bukanlah orang yang suka melaknat. (HR. Tirmidzi)",
    "Barangsiapa menjaga lisannya maka ia selamat. (HR. Tirmidzi)",
    "Sesungguhnya malu adalah bagian dari iman. (HR. Bukhari & Muslim)",
    "Kejujuran membawa kepada surga. (HR. Bukhari & Muslim)",

    "Jangan saling membenci. (HR. Muslim)",
    "Jangan saling memutuskan hubungan. (HR. Muslim)",
    "Bertakwalah kepada Allah di mana pun kamu berada. (HR. Tirmidzi)",
    "Ikutilah keburukan dengan kebaikan. (HR. Tirmidzi)",
    "Pergaulilah manusia dengan akhlak yang baik. (HR. Tirmidzi)",

    "Barangsiapa memberi makan orang yang lapar maka Allah akan memberinya makan di hari kiamat. (HR. Tirmidzi)",
    "Barangsiapa memberi minum orang yang haus maka Allah akan memberinya minum di hari kiamat. (HR. Tirmidzi)",
    "Barangsiapa menolong saudaranya maka Allah akan menolongnya. (HR. Muslim)",
    "Sesungguhnya Allah bersama orang yang sabar. (HR. Muslim)",
    "Sesungguhnya amal yang paling dicintai Allah adalah yang kontinu walau sedikit. (HR. Bukhari & Muslim)",

    "Allah merahmati orang yang bersikap lembut. (HR. Bukhari)",
    "Jangan meremehkan kebaikan sekecil apa pun. (HR. Muslim)",
    "Barangsiapa berbuat baik maka ia akan mendapatkan kebaikan. (HR. Muslim)",
    "Allah mencintai orang yang bertakwa. (HR. Muslim)",
    "Sesungguhnya Allah mencintai orang yang sabar. (HR. Muslim)",

    "Sesungguhnya Allah mencintai orang yang bertawakal. (HR. Tirmidzi)",
    "Sesungguhnya Allah mencintai orang yang bersyukur. (HR. Muslim)",
    "Sesungguhnya Allah mencintai orang yang bertaubat. (HR. Muslim)",
    "Sesungguhnya Allah mencintai orang yang bersuci. (HR. Bukhari)",
    "Sesungguhnya Allah mencintai orang yang berbuat adil. (HR. Muslim)",

    "Shalat adalah tiang agama. (HR. Baihaqi)",
    "Puasa adalah perisai. (HR. Bukhari & Muslim)",
    "Zakat membersihkan harta. (HR. Muslim)",
    "Haji yang mabrur tidak ada balasan selain surga. (HR. Bukhari & Muslim)",
    "Orang mukmin yang paling sempurna imannya adalah yang paling baik akhlaknya. (HR. Tirmidzi)",

    "Barangsiapa mengingat Allah maka Allah akan mengingatnya. (HR. Bukhari)",
    "Sesungguhnya dzikir menenangkan hati. (HR. Muslim)",
    "Perbanyaklah mengingat Allah. (HR. Tirmidzi)",
    "Orang yang berdzikir dan yang tidak seperti orang hidup dan mati. (HR. Bukhari)",
    "Allah dekat dengan hamba yang berdoa kepada-Nya. (HR. Muslim)"

]
// ======================
// Template welcome & goodbye
// ======================
const defaultIntroCard = '╭──🎉 SELAMAT DATANG ──╮\n│ Halo @user\n│ Di grup @group\n│ Pada @tanggal\n╰────────────────────╯';
const defaultOutCard = '╭──👋 GOOD BYE ─╮\n│ @user telah keluar\n│ Dari grup @group\n│ Pada @tanggal\n╰────────────────╯';

function renderIntroCard(template, { userTag, groupName }) {
    const now = new Date();
    const tanggal = now.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    return template.replace(/@user/g, userTag)
        .replace(/@group/g, groupName)
        .replace(/@tanggal/g, tanggal);
}

// ================= GLOBAL =================
let groupCache = []

global.sentToday = {
    subuh: { wib: false, wita: false, wit: false },
    dzuhur: { wib: false, wita: false, wit: false },
    ashar: { wib: false, wita: false, wit: false },
    maghrib: { wib: false, wita: false, wit: false },
    isya: { wib: false, wita: false, wit: false },
    morning: false,
    night: false
}
let prayerTimes = {
    wib: {},
    wita: {},
    wit: {}
}
let qrGlobal = ""; // simpan QR terbaru
let broadcastQueue = []
let isBroadcasting = false
function zoneExample(zone) {

    if (zone === "wib") {
        return "Jakarta, Bandung, Surabaya, Medan, Palembang, Lampung, Semarang, Yogyakarta, Pontianak, dan sekitarnya"
    }

    if (zone === "wita") {
        return "Makassar, Bali, Mataram (NTB), Kupang (NTT), Balikpapan, Samarinda, Manado, Palu, Kendari, dan sekitarnya"
    }

    if (zone === "wit") {
        return "Jayapura, Ambon, Ternate, Sorong, Manokwari, Nabire, Merauke, dan sekitarnya"
    }

}

let shuffledHadith = []
let hadithIndex = 0

function shuffleHadith() {

    shuffledHadith = [...hadithList]

    for (let i = shuffledHadith.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1))

            ;[shuffledHadith[i], shuffledHadith[j]] = [shuffledHadith[j], shuffledHadith[i]]

    }

    hadithIndex = 0
}

function getNextHadith() {

    if (shuffledHadith.length === 0 || hadithIndex >= shuffledHadith.length) {
        shuffleHadith()
    }

    const hadith = shuffledHadith[hadithIndex]

    hadithIndex++

    return hadith
}
function addBroadcast(text) {

    for (const gid of groupCache) {
        if (!gid.endsWith("@g.us")) continue
        broadcastQueue.push({ gid, text })
    }

    processBroadcastQueue()
}

async function processBroadcastQueue() {

    if (isBroadcasting) return
    isBroadcasting = true

    while (broadcastQueue.length > 0) {

        const job = broadcastQueue.shift()

        try {

            if (!sock || !sock.user) return

            await sock.sendMessage(job.gid, { text: job.text })

            console.log("📤 Broadcast:", job.gid)

        } catch (err) {

            console.log("❌ Gagal kirim:", job.gid)

        }

        await delay(2500) // delay aman WA
    }

    isBroadcasting = false
}

async function updatePrayerTimes() {

    try {

        const today = new Date().toISOString().split("T")[0]

        const [jakarta, makassar, jayapura] = await Promise.all([
            fetch(`https://api.myquran.com/v2/sholat/jadwal/1301/${today}`),
            fetch(`https://api.myquran.com/v2/sholat/jadwal/1108/${today}`),
            fetch(`https://api.myquran.com/v2/sholat/jadwal/1505/${today}`)
        ])

        const jkt = await jakarta.json()
        const mks = await makassar.json()
        const jyp = await jayapura.json()

        prayerTimes = {
            wib: jkt.data.jadwal,
            wita: mks.data.jadwal,
            wit: jyp.data.jadwal
        }

        console.log("🕌 Jadwal sholat:", JSON.stringify(prayerTimes, null, 2))

    } catch (err) {

        console.log("❌ Gagal ambil jadwal:", err.message)

    }

}
function matchTime(hour, minute, timeStr) {

    if (!timeStr) return false

    const [h, m] = timeStr.split(":").map(Number)

    return hour === h && minute === m
}
async function broadcastAdzan(text) {

    const audio = fs.readFileSync("./media/azan1.mp3")

    await Promise.all(
        groupCache.map(async (gid) => {

            if (!gid.endsWith("@g.us")) return

            try {

                console.log("📢 kirim adzan ke:", gid)

                await sock.sendMessage(gid, {
                    audio: audio,
                    mimetype: "audio/mpeg"
                })

                await sock.sendMessage(gid, {
                    text: text
                })

            } catch (err) {

                console.log("❌ gagal kirim:", gid, err.message)

            }

        })
    )
}
async function broadcastHadith() {

    const hadith = getNextHadith()

    const message = `📜 *Hadits Hari Ini*

${hadith}

✨ Semoga menjadi pengingat dan membawa keberkahan bagi kita semua.

🤲 Selamat menjalani aktivitas hari ini.
`

    await Promise.all(
        groupCache.map(async (gid) => {

            if (!gid.endsWith("@g.us")) return

            try {

                await sock.sendMessage(gid, {
                    text: message
                })

            } catch { }

        })
    )
}

// ================= FUNCTION =================
let lastGroupFetch = 0

// ======================
// GLOBAL BOT
// ======================

let schedulerStarted = false
let lastResetTime = 0; // simpan waktu terakhir reset

setInterval(async () => {
    if (!sock || !sock.user) return;

    const now = Date.now();

    const INTERVAL_14_HARI = 14 * 24 * 60 * 60 * 1000; // ✅ 14 hari

    const RESET_FILE = './database/lastreset.json';
    const CHAT_COUNT_PATH = './database/chatcount.json';

    // load waktu reset terakhir
    if (fs.existsSync(RESET_FILE)) {
        const data = JSON.parse(fs.readFileSync(RESET_FILE));
        lastResetTime = data.lastReset || 0;
    } else {
        // kalau belum ada file, buat
        fs.writeFileSync(RESET_FILE, JSON.stringify({
            lastReset: now
        }, null, 2));
        return;
    }

    // cek apakah sudah 14 hari
    if (now - lastResetTime >= INTERVAL_14_HARI) {

        console.log("🧹 Reset 14 hari dimulai...");

        let chatCount = {};
        if (fs.existsSync(CHAT_COUNT_PATH)) {
            chatCount = JSON.parse(fs.readFileSync(CHAT_COUNT_PATH));
        }

        // 🔥 kirim top user ke semua grup
        for (const groupId in chatCount) {
            const users = chatCount[groupId];

            const sorted = Object.entries(users)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            let text = `╭──📊 *RESET 14 HARIAN* ──⬣
│ Statistik pesan telah direset!
│
│ 🏆 Top Member 14 Hari:
`;

            if (sorted.length === 0) {
                text += `│ (Belum ada data)\n`;
            } else {
                sorted.forEach((u, i) => {
                    const medal = ['🥇', '🥈', '🥉'][i] || '🏅';
                    text += `│ ${medal} @${u[0].split('@')[0]} (${u[1]} pesan)\n`;
                });
            }

            text += `╰─────────────⬣`;

            try {
                await sock.sendMessage(groupId, {
                    text,
                    mentions: sorted.map(u => u[0])
                });
            } catch (err) {
                console.log("❌ Gagal kirim ke:", groupId);
            }
        }

        // 🧹 reset data
        fs.writeFileSync(CHAT_COUNT_PATH, JSON.stringify({}, null, 2));

        // simpan waktu reset baru
        fs.writeFileSync(RESET_FILE, JSON.stringify({
            lastReset: now
        }, null, 2));

        console.log("✅ Reset 14 hari selesai");
    }

}, 60000);
// ======================
// UPDATE GROUP CACHE SAFE
// ======================
async function updateGroupCache() {

    if (!sock || !sock.user) {
        console.log("⚠️ Skip update group cache (socket belum ready)")
        return
    }

    const now = Date.now()

    if (now - lastGroupFetch < 60 * 60 * 1000) {
        console.log("⚠️ Skip update group cache (cooldown)")
        return
    }

    try {

        const groupsData = await sock.groupFetchAllParticipating()

        groupCache = Object.keys(groupsData)

        lastGroupFetch = now

        console.log("✅ Group list updated:", groupCache.length)

    } catch (err) {

        console.log("❌ Gagal update group cache:", err.message)

        if (err.message.includes("rate-overlimit")) {

            console.log("⏳ Rate limit... coba lagi 60 detik")

            setTimeout(updateGroupCache, 60000)

        }

    }

}

function zoneText(zone) {
    if (zone === "wib") return "WIB"
    if (zone === "wita") return "WITA"
    if (zone === "wit") return "WIT"
}
async function checkPrayerTime(hour, minute, zone) {

    const prayers = [
        { key: "subuh", name: "SUBUH" },
        { key: "dzuhur", name: "DZUHUR" },
        { key: "ashar", name: "ASHAR" },
        { key: "maghrib", name: "MAGHRIB" },
        { key: "isya", name: "ISYA" }
    ]

    for (const p of prayers) {

        if (global.sentToday[p.key][zone]) continue

        let timeStr = null

        if (zone === "wib") timeStr = prayerTimes.wib?.[p.key]
        if (zone === "wita") timeStr = prayerTimes.wita?.[p.key]
        if (zone === "wit") timeStr = prayerTimes.wit?.[p.key]

        if (!matchTime(hour, minute, timeStr)) continue

        const zona = zoneText(zone)

        const finalMessage = `🕌 *Adzan ${p.name}*

Alhamdulillah, waktu sholat *${p.name}* sudah masuk.

Teman-teman yang berada di wilayah *${zona}*
(contoh: ${zoneExample(zone)}),
yuk sejenak tinggalkan aktivitas dan menunaikan sholat terlebih dahulu.

Semoga Allah menerima ibadah kita semua 🤲`

        console.log(`🕌 Adzan ${p.name} untuk ${zona}`)

        await broadcastAdzan(finalMessage)

        global.sentToday[p.key][zone] = true

        break
    }
}
let schedulerInterval = null

function startScheduler() {

    if (schedulerInterval) {
        console.log("⚠️ Scheduler sudah berjalan")
        return
    }

    console.log("🕒 Scheduler started")

    schedulerInterval = setInterval(async () => {

        const nowWIB = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
        const nowWITA = new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" })
        const nowWIT = new Date().toLocaleString("en-US", { timeZone: "Asia/Jayapura" })

        const wib = new Date(nowWIB)
        const wita = new Date(nowWITA)
        const wit = new Date(nowWIT)

        const hourWIB = wib.getHours()
        const minuteWIB = wib.getMinutes()

        const hourWITA = wita.getHours()
        const minuteWITA = wita.getMinutes()

        const hourWIT = wit.getHours()
        const minuteWIT = wit.getMinutes()

        console.log(`⏰ WIB ${hourWIB}:${minuteWIB} | WITA ${hourWITA}:${minuteWITA} | WIT ${hourWIT}:${minuteWIT} | Groups: ${groupCache.length}`)

        if (!groupCache.length) return

        try {

            // PAGI
            if (hourWIB === 8 && minuteWIB >= 5 && minuteWIB <= 10 && !global.sentToday.morning) {

                console.log("🌅 Mengirim pesan pagi...")

                addBroadcast(`☀️ *SELAMAT PAGI SEMUA!* ☀️

Bangun dengan senyum, tarik napas dalam, dan sambut hari dengan semangat baru! 🌿`)

                global.sentToday.morning = true
            }

            // MALAM
            if (hourWIB === 22 && minuteWIB === 2 && !global.sentToday.night) {

                console.log("🌙 Mengirim pesan malam...")

                addBroadcast(`🌙 *SELAMAT MALAM & ISTIRAHAT* 🌙

Hari ini sudah berakhir, saatnya recharge tubuh dan pikiran.`)

                global.sentToday.night = true
            }
            // HADITS HARIAN
            if (hourWITA === 5 && minuteWITA === 15 && !global.sentToday.hadith) {

                console.log("📜 Mengirim hadits harian...")

                await broadcastHadith()

                global.sentToday.hadith = true
            }
            await checkPrayerTime(hourWIB, minuteWIB, "wib")
            await checkPrayerTime(hourWITA, minuteWITA, "wita")
            await checkPrayerTime(hourWIT, minuteWIT, "wit")

        } catch (err) {

            console.log("Scheduler error:", err)

        }

        // reset harian
        if (hourWIB === 0 && minuteWIB === 1) {

            global.sentToday = {
                subuh: { wib: false, wita: false, wit: false },
                dzuhur: { wib: false, wita: false, wit: false },
                ashar: { wib: false, wita: false, wit: false },
                maghrib: { wib: false, wita: false, wit: false },
                isya: { wib: false, wita: false, wit: false },
                morning: false,
                night: false,
                hadith: false
            }

            await updatePrayerTimes()

            console.log("🔄 Reset scheduler flag")
        }

    }, 60000)
}
setInterval(() => {

    const used = process.memoryUsage().heapUsed / 1024 / 1024

    if (used > 500) {
        console.log(`⚠️ Memory tinggi: ${used.toFixed(2)} MB`)
        global.gc?.()
    }
    global.sentToday
}, 300000)
// ======================
// Status siap
// ======================
let isReady = false;
setTimeout(() => {
    isReady = true;
    console.log("✅ Bot siap terima event peserta grup");
}, 10000);

// ======================
// Function kirim pesan aman
// ======================
async function safeSendMessage(sock, jid, message) {

    if (!global.BOT_ACTIVE) return;

    try {

        const cfg = getGroupConfig()

        if (
            jid.endsWith("@g.us") &&
            cfg[jid]?.allowImage === false &&
            message.systemImage
        ) {

            const text = message.caption || message.text || ""

            message = {
                text,
                mentions: message.mentions || []
            }

        }

        delete message.systemImage

        await sock.sendMessage(jid, message)

    } catch (err) {

        console.error("❌ Error kirim pesan:", err)

    }

}
// ======================
// Admin command queue
// ======================
const STATS_FILE = "./bot_stats.json"
const GROUP_FILE = "./group_list.json"
process.on("uncaughtException", err => {
    console.log("🔥 BOT CRASH:", err)
})

process.on("unhandledRejection", err => {
    console.log("🔥 PROMISE ERROR:", err)
})
setInterval(async () => {

    if (!global.BOT_ACTIVE) return;

    if (!sock || !sock.user) {
        return
    }

    try {

        const groupsData = await sock.groupFetchAllParticipating()
        const groupIds = Object.keys(groupsData)

        const groupList = []
        let userCount = 0

        for (const gid of groupIds) {

            const meta = groupsData[gid]
            if (!meta) continue

            userCount += meta.participants.length

            groupList.push({
                id: gid,
                name: meta.subject,
                size: meta.participants.length
            })
        }

        fs.writeFileSync(STATS_FILE, JSON.stringify({
            groups: groupIds.length,
            users: userCount
        }, null, 2))

        fs.writeFileSync(GROUP_FILE, JSON.stringify(groupList, null, 2))

        console.log("✅ group_list.json updated")

    } catch (err) {

        console.error("❌ Error update group list:", err.message)

    }

}, 60000)

const app = express();
const PORT = process.env.PORT || 3000;

// ROOT TEST
app.get("/", (req, res) => {
    res.send("✅ MR.A BOT API RUNNING 🚀");
});

// QR ENDPOINT
app.get("/qr", async (req, res) => {
    console.log("🔥 /qr diakses");

    if (!qrGlobal) {
        return res.send("❌ QR belum tersedia, bot mungkin sudah login.");
    }

    try {
        const qrDataUrl = await qrcode.toDataURL(qrGlobal);
        res.send(`
            <h1>Scan QR WhatsApp</h1>
            <img src="${qrDataUrl}" />
        `);
    } catch (err) {
        res.send("❌ Error generate QR: " + err.message);
    }
});

// LISTEN FIX
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Server jalan di port ${PORT}`);
});

async function startBot() {
    await new Promise(r => setTimeout(r, 3000))
    await connectMongo()

    const { state, saveCreds } = await useMongoAuthState()
    const { version } = await fetchLatestBaileysVersion();
    if (BOT_ACTIVE) {
        console.log("⚠️ Bot sudah aktif")
        return
    }

    BOT_ACTIVE = true
    fs.writeFileSync("bot_status.txt", "RUNNING")
    sock = makeWASocket({
        version,
        logger: customLogger,
        auth: state,

        browser: ['Windows', 'Chrome', '120.0'],

        // koneksi stabil
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,

        // performa
        markOnlineOnConnect: true,
        syncFullHistory: false,
        emitOwnEvents: false,

        // anti crash
        generateHighQualityLinkPreview: false,

        patchMessageBeforeSending: (message) => {
            return message
        }
    });


    
    // ======================
    // WHATSAPP CONNECTION
    // ======================

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // ======================
        // GENERATE QR CODE
        // ======================

        if (qr) {
            qrGlobal = qr;

            console.log("📱 QR WhatsApp berhasil didapat!");

            try {
                const qrImage = await qrcode.toDataURL(qr);

                const flaskUrl = "http://127.0.0.1:5001";

                const response = await fetch(`${flaskUrl}/set-qr`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        qr: qrImage
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    console.log("✅ QR berhasil dikirim ke Flask!");
                } else {
                    console.error("❌ Flask menolak QR:", result);
                }

            } catch (error) {
                console.error(
                    "❌ Gagal mengirim QR:",
                    error.message
                );
            }

            // QR EXPIRED TIMEOUT
            if (global.qrResetTimeout) {
                clearTimeout(global.qrResetTimeout);
            }

            global.qrResetTimeout = setTimeout(() => {
                if (sock && !sock.user) {
                    console.log("🔄 QR kedaluwarsa, meminta QR baru...");
                    sock.end(new Error("QR Expired Timeout"));
                }
            }, 45000);
        }

        // ======================
        // CONNECTION CLOSED
        // ======================

        if (connection === "close") {
            const statusCode =
                lastDisconnect?.error?.output?.statusCode;

            console.log("❌ Koneksi terputus:", statusCode);

            BOT_ACTIVE = false;
            fs.writeFileSync("bot_status.txt", "OFFLINE");

            if (statusCode !== DisconnectReason.loggedOut) {
                console.log("🔄 Mencoba menghubungkan ulang...");

                setTimeout(() => {
                    startBot();
                }, 5000);

            } else {
                console.log(
                    "⚠️ WhatsApp logout. Silakan scan QR kembali."
                );
            }
        }

        // ======================
        // CONNECTION OPEN
        // ======================

        if (connection === "open") {
            console.log("✅ WhatsApp berhasil terhubung!");

            BOT_ACTIVE = true;
            fs.writeFileSync("bot_status.txt", "RUNNING");

            if (global.qrResetTimeout) {
                clearTimeout(global.qrResetTimeout);
                global.qrResetTimeout = null;
            }
        }
    });
    
    
    // ======================
    // QC scheduler
    // ======================
    setInterval(async () => {
        if (!global.BOT_ACTIVE) return;;
        if (!fs.existsSync('./database/qc.json')) return;
        const qcData = JSON.parse(fs.readFileSync('./database/qc.json'));
        const now = new Date();
        const jam = now.toTimeString().slice(0, 5);

        for (const groupId in qcData) {
            const qcs = qcData[groupId];
            const qcNow = qcs.filter(q => q.time === jam);
            if (qcNow.length === 0) continue;

            try {
                const metadata = await getGroupMetadataSafe(sock, groupId);
                if (!metadata) continue;
                const mentions = metadata.participants.map(p => p.id);

                for (const qc of qcNow) {
                    const text = `╭──📢 ${qc.title.toUpperCase()} ──⬣\n│ 🕒 ${qc.time}\n╰─────────────⭓\n${qc.content}`;
                    await safeSendMessage(sock, groupId, { text, mentions });
                }
            } catch (err) { console.error(`❌ Gagal kirim QC ke grup ${groupId}:`, err.message); }
        }
    }, 60 * 1000);

    // ======================
    // Group participant update
    // ======================
    sock.ev.on("group-participants.update", async (update) => {
        if (!isReady || !BOT_ACTIVE) return;

        const { id, participants, action } = update;

        try {

            const groupMeta = await getGroupMetadataSafe(sock, id)
            if (!groupMeta) return

            const groupName = groupMeta.subject
            const groupConfig = getGroupConfig()

            if (!groupConfig[id]?.notif) return

            for (const p of participants) {

                const participant = typeof p === "string" ? p : p.id
                const userTag = `@${participant.split("@")[0].split(":")[0]}`

                if (action === "add") {

                    const template = groupConfig[id]?.introcard || defaultIntroCard
                    const caption = renderIntroCard(template, { userTag, groupName }).replace(/\\n/g, '\n')

                    let groupPic
                    try {
                        groupPic = await sock.profilePictureUrl(id, "image")
                    } catch {
                        groupPic = "./bot/menu.jpg"
                    }

                    // cek apakah gambar diizinkan
                    if (groupConfig[id]?.allowImage === false) {

                        await safeSendMessage(sock, id, {
                            text: caption,
                            mentions: [participant]
                        })

                    } else {

                        await safeSendMessage(sock, id, {
                            image: { url: groupPic },
                            caption,
                            mentions: [participant],
                            systemImage: true
                        })

                    }

                } else if (action === "remove") {

                    const template = groupConfig[id]?.outcard || defaultOutCard
                    const caption = renderIntroCard(template, { userTag, groupName }).replace(/\\n/g, '\n')

                    if (groupConfig[id]?.allowImage === false) {

                        await safeSendMessage(sock, id, {
                            text: caption,
                            mentions: [participant]
                        })

                    } else {

                        let groupPic
                        try {
                            groupPic = await sock.profilePictureUrl(id, "image")
                        } catch {
                            groupPic = "./bot/menu.jpg"
                        }

                        await safeSendMessage(sock, id, {
                            image: { url: groupPic },
                            caption,
                            mentions: [participant]
                        })

                    }

                }
            }

        } catch (e) {
            console.error("❌ Error handle group update:", e)
        }
    })

    // ======================
    // Messages
    // ======================
    let processing = false
    const queue = []

    sock.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages?.[0]
        if (!msg) return
        if (!msg.message) return

        // ❌ jangan blok status broadcast
        // if (msg.key?.remoteJid === 'status@broadcast') return

        if (msg.key?.fromMe && !msg.message?.conversation) return

        queue.push(msg)

        if (processing) return
        processing = true

        while (queue.length) {
            const m = queue.shift()
            try {

                // jalankan anti status dulu
                await antiStatusMention({
                    sock,
                    msg: m,
                    groupConfig: getGroupConfig()
                })

                // ❌ CEK BOT ACTIVE SEBELUM HANDLER
                const isCommand = m.message?.conversation?.startsWith("!") || m.message?.conversation?.startsWith(".");
                if (!BOT_ACTIVE && isCommand) {
                    await sock.sendMessage(m.key.remoteJid, {
                        text: '⚠️ Bot sedang OFF. Tidak bisa menerima command.'
                    });
                    continue;
                }

                // baru handler utama
                await messageHandler(m, sock)
            } catch (e) {
                console.log("Handler error:", e)
            }
        }

        processing = false
    })
}

export async function stopBot() {
    if (!BOT_ACTIVE) {
        console.log("⚠️ Bot sudah berhenti");
        return;
    }

    try {
        if (sock) {
            await sock.logout();
            sock = null;
        }
        BOT_ACTIVE = false;
        updateStatusFile('OFFLINE');
        stopScheduler();
        console.log("🛑 Bot stopped");
    } catch (err) {
        console.error("❌ Gagal stop bot:", err.message);
    }
}
setInterval(() => {

    if (!fs.existsSync("command_queue.txt")) return

    const data = fs.readFileSync("command_queue.txt", "utf8").trim()

    if (!data) return

    const commands = data.split("\n")

    const remaining = []

    commands.forEach(cmd => {

        cmd = cmd.trim()

        if (!cmd) return

        console.log("📥 CMD:", cmd)

        if (cmd.startsWith("!startbot")) {

            startBot()
            return

        }

        if (cmd.startsWith("!stopbot")) {

            stopBot()
            return

        }

        // command lain biarkan
        remaining.push(cmd)

    })

    fs.writeFileSync("command_queue.txt", remaining.join("\n"))

}, 60000)
// ======================
// Tampilan awal di console
// ======================
console.clear();
console.log(chalk.cyan(figlet.textSync("MR.A BOT", { horizontalLayout: "default" })));
console.log(chalk.green(`⏰ ${moment().format("LLLL")}`));
console.log(chalk.yellow("🔄 Memulai bot..."));

// ======================
// Jalankan bot
// ======================
startBot();
