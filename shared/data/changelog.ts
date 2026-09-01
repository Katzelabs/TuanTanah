// What players see on the "What's new" page (ClickUp 86eyr3xvf).
//
// ============================================================================
// HOW TO ADD AN ENTRY
//
//   1. Add your line to the TOP release below, under the right `kind`.
//   2. Write it for a player, not for us. "Fixed players being kicked out of
//      their room after losing connection" — not "refactor socket session
//      keying". If a line only makes sense to someone who has read the diff,
//      it does not belong here.
//   3. Write BOTH `en` and `id`. A test fails on a missing one.
//   4. Cutting a release also means bumping `APP_VERSION` + the root
//      package.json and adding a new release object here, newest first. A test
//      fails if the newest version and `APP_VERSION` disagree.
//
// Do this in the SAME PR as the change it describes. That is the whole
// mechanism: a changelog maintained as a separate chore goes stale within two
// releases, and a page that says the game stopped moving six months ago is worse
// than no page at all.
// ============================================================================
import type { ChangelogRelease } from '../types/changelog.js'

/** Newest first. The order is asserted, not sorted at render. */
export const CHANGELOG: readonly ChangelogRelease[] = [
  {
    version: '0.2.0',
    date: '2026-09-01',
    changes: [
      {
        kind: 'new',
        en: 'Rules you can actually reach: what you are trying to win, how a turn works, and what every button does — openable in the middle of a match without leaving it.',
        id: 'Aturan yang benar-benar bisa kamu buka: apa yang harus kamu menangkan, bagaimana satu giliran berjalan, dan fungsi setiap tombol — bisa dibuka di tengah pertandingan tanpa keluar dari permainan.',
      },
      {
        kind: 'new',
        en: 'You can now report a bug or send us an idea from inside the game — the button is in the top bar, and opening it will not take you out of your match.',
        id: 'Sekarang kamu bisa melaporkan bug atau mengirim ide langsung dari dalam game — tombolnya ada di bar atas, dan membukanya tidak akan mengeluarkanmu dari pertandingan.',
      },
      {
        kind: 'new',
        en: 'This page. Every update from now on gets written up here, so you can see what changed.',
        id: 'Halaman ini. Mulai sekarang setiap pembaruan ditulis di sini, jadi kamu bisa lihat apa yang berubah.',
      },
      {
        kind: 'new',
        en: 'The version you are playing is shown at the bottom of the home page and in your account settings.',
        id: 'Versi yang kamu mainkan ditampilkan di bagian bawah halaman utama dan di pengaturan akun.',
      },
      {
        kind: 'improved',
        en: 'On a phone, press and hold a button to see what it does. Tips used to need a mouse hover, so on touch they never appeared at all.',
        id: 'Di ponsel, tekan dan tahan sebuah tombol untuk melihat fungsinya. Sebelumnya keterangan itu butuh kursor mouse, jadi di layar sentuh tidak pernah muncul sama sekali.',
      },
      {
        kind: 'improved',
        en: 'The lobby now tells you why a game cannot start yet instead of just leaving the start button greyed out.',
        id: 'Lobi sekarang memberi tahu kenapa permainan belum bisa dimulai, bukan sekadar menonaktifkan tombol mulai.',
      },
      {
        kind: 'improved',
        en: 'The home page, lobby, and board all fit a phone screen properly.',
        id: 'Halaman utama, lobi, dan papan sekarang pas di layar ponsel.',
      },
      {
        kind: 'fixed',
        en: 'Losing your connection no longer costs you your seat. You have 45 seconds to get back in, and a brief drop now reconnects you instead of pushing you out of the room.',
        id: 'Koneksi yang terputus tidak lagi membuatmu kehilangan kursi. Kamu punya 45 detik untuk kembali, dan gangguan sesaat kini menyambungkanmu lagi, bukan mengeluarkanmu dari room.',
      },
      {
        kind: 'fixed',
        en: 'If the room master leaves and does not come back, the room now passes to someone who is still there — a lobby no longer gets stuck waiting on a player who is gone.',
        id: 'Kalau room master keluar dan tidak kembali, room sekarang diserahkan ke pemain lain yang masih ada — lobi tidak lagi macet menunggu pemain yang sudah pergi.',
      },
      {
        kind: 'fixed',
        en: 'Fixed games that could stall on an auction, or keep going past the time limit they were set.',
        id: 'Memperbaiki permainan yang bisa mandek saat lelang, atau terus berjalan melewati batas waktu yang sudah diatur.',
      },
    ],
  },
]
