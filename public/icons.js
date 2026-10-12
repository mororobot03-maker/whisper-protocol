// =====================================================
//  위스퍼 프로토콜 - 아이콘 세트 (icons.js)
//  - 모두 24×24 격자, 선 굵기 2, 둥근 끝 → 같은 스타일로 통일
//  - 색은 주변 글자색(currentColor)을 따라감
//    → CSS에서 color만 바꾸면 부상(주황), 사망(회색) 등 상태 표현 가능
//  사용법: icon("heart")  →  <svg> 요소를 돌려줌
// =====================================================

const ICON_PATHS = {
  // ----- 상태 -----
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor"/>',
  heartCracked: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" fill="currentColor" fill-opacity=".35"/><path d="M12 7.6l-1.6 3.6 2.6 1.6-1.8 4"/>',
  heartEmpty: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
  credit: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5" stroke-dasharray="2 2.2"/><path d="M13.6 10.2a2.2 2.2 0 1 0 0 3.6"/>',
  clock: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.8M9.5 3h5"/>',
  appMemo: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M15 3.5V7h3.5M9 11h6.5M9 14.5h6.5M9 18h4"/>',
  soundOn: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  music: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  musicOff: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/><path d="M3 3l18 18"/>',
  soundOff: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>',
  skull: '<path d="M12 3.5a7.5 7.5 0 0 0-4.5 13.5v3h9v-3A7.5 7.5 0 0 0 12 3.5z"/><circle cx="9.3" cy="11.5" r="1.5" fill="currentColor"/><circle cx="14.7" cy="11.5" r="1.5" fill="currentColor"/><path d="M10.5 20v-2M13.5 20v-2"/>',

  // ----- 단계 -----
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  talk: '<path d="M4 5.5h10a2 2 0 0 1 2 2V12a2 2 0 0 1-2 2H9l-3.5 3v-3H4a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z"/><path d="M16 9h4a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-1.5v3L15 17.5h-3"/>',
  megaphone: '<path d="M3.5 10v4h3l7.5 4.5v-13L6.5 10h-3z"/><path d="M17.5 8.5a5 5 0 0 1 0 7M20 6a8.5 8.5 0 0 1 0 12"/>',
  ballot: '<rect x="4" y="11" width="16" height="9.5" rx="1.5"/><path d="M8 11V4.5h8V11M10 8l1.5 1.5L14.5 6"/><path d="M8 15h8"/>',
  ship: '<ellipse cx="12" cy="9" rx="9" ry="4.5"/><path d="M9 13.2V16h6v-2.8M7 9h10"/>',

  // ----- 앱 (탭) -----
  appChat: '<path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 16V6A1.5 1.5 0 0 1 4 4.5z"/><path d="M7 9.5h10M7 13h6"/>',
  appInfo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.5 16c.6-1.6 1.7-2.3 3-2.3s2.4.7 3 2.3M14 9.5h4M14 13h4"/>',
  appAction: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  appShop: '<path d="M3.5 8.5L12 4l8.5 4.5v9L12 22l-8.5-4.5z"/><path d="M3.5 8.5L12 13l8.5-4.5M12 13v9"/>',
  appDarknet: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M6.5 9.5l3 2.5-3 2.5M12 15h5"/>',
  appBank: '<path d="M3 9.5L12 4l9 5.5"/><path d="M5 10v7.5M9.5 10v7.5M14.5 10v7.5M19 10v7.5M3 20.5h18"/>',
  appCasino: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/>',
  appVote: '<rect x="4" y="11" width="16" height="9.5" rx="1.5"/><path d="M8 11V4.5h8V11M10 8l1.5 1.5L14.5 6"/>',

  // ----- 효과 시점 -----
  tonight: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  tomorrow: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  inbox: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  multi: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',

  // ----- 암상인 아이템 -----
  proxy: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 11l7.4-3.8M8.3 13l7.4 3.8"/>',
  firewall: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8 11h8M8 14.5h8M12 7.5V11M10 11v3.5M14 11v3.5"/>',
  armor: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  decoy: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c.8-3.3 2.9-5 5.5-5s4.7 1.7 5.5 5"/><circle cx="16" cy="8" r="3" stroke-dasharray="2 2"/><path d="M17 14.6c2 .5 3.2 2.1 3.7 4.9" stroke-dasharray="2 2"/>',
  launder: '<circle cx="12" cy="13" r="7.5"/><path d="M8 13.5c1.3-1.4 2.7-1.4 4 0s2.7 1.4 4 0"/><path d="M7 3.5h10"/>',
  scanner: '<path d="M3 12h4l2-5 3 10 2.5-7 1.5 2h5"/><path d="M3 4.5V3h3M21 4.5V3h-3M3 19.5V21h3M21 19.5V21h-3"/>',
  translog: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  wiretap: '<path d="M6 13a6 6 0 0 1 12 0v3a2 2 0 0 1-2 2h-1v-6h3M6 13v3a2 2 0 0 0 2 2h1v-6H6"/><path d="M12 18v3"/>',
  mask: '<path d="M4 7.5c3-1.5 13-1.5 16 0 0 6-3.5 10-8 10s-8-4-8-10z"/><path d="M8 11.5c.8-.7 2-.7 2.8 0M13.2 11.5c.8-.7 2-.7 2.8 0"/><path d="M10.5 14.5h3"/>',
  jammer: '<path d="M12 12v9M8 21h8"/><path d="M8.5 8.5a5 5 0 0 1 7 0M5.5 5.5a9 9 0 0 1 13 0"/><path d="M4 3l16 16"/>',
  deepfake: '<rect x="2.5" y="5" width="19" height="13" rx="2"/><path d="M8 21h8"/><path d="M7 11.5h3l1.5-2.5 2 5 1.5-2.5h2"/>',
  scramble: '<path d="M4 6h16M4 12h7M15 12h5M4 18h10"/><path d="M12 9l2 2-2 2M16 15l2 2-2 2"/>',
  block: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M8.5 8.5l7 5M15.5 8.5l-7 5"/>',
  forge: '<path d="M3 6.5h12v9H3z"/><path d="M3 7l6 4.5L15 7"/><path d="M14 20l6.5-6.5-2-2L12 18v2z"/>',
  commlog: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><circle cx="15" cy="9" r="1.6"/><path d="M10.6 9h2.8M8 14h8M8 17.5h5"/>',
  speaker: '<path d="M3.5 10v4h3l7.5 4.5v-13L6.5 10h-3z"/><path d="M17.5 8.5a5 5 0 0 1 0 7M20 6a8.5 8.5 0 0 1 0 12"/><path d="M10 2.5l-2 3"/>',
  gavel: '<path d="M13.5 3.5l6 6M11 6l6 6M12.2 4.8l-4.4 4.4 6 6 4.4-4.4"/><path d="M10.5 12.5L4 19l1.5 1.5L12 14"/><path d="M13 21h8"/>',
  bribe: '<path d="M3 13.5l4-3.5 4 2.5 2-1"/><path d="M21 13.5l-4-3.5-3.5 1-4 3.5a1.4 1.4 0 0 0 2 2l2-1.5 3 3 2-2"/><path d="M3 13.5l5 5 1.5-1.5"/>',
  miner: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/><path d="M8.5 2v2M15.5 2v2M8.5 20v2M15.5 20v2M2 8.5h2M2 15.5h2M20 8.5h2M20 15.5h2"/>',

  // ----- 다크넷 서비스 -----
  track: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8.5 11h5M11 8.5v5"/>',
  census: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="9.5" r="2.5"/><path d="M8 16.5c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6"/>',
  contract: '<path d="M5 19L18 6M14.5 4.5l5 5"/><path d="M5 19l-1.5.5.5-1.5M9 12l3 3"/>',
  drone: '<rect x="8.5" y="10" width="7" height="5" rx="1.5"/><path d="M8.5 12.5H4M15.5 12.5H20M4 10v5M20 10v5M12 10V8M10.5 6h3"/>',
  medic: '<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>',

  // ----- 직업 (role_ + 직업 id) -----
  role_vip: '<path d="M3.5 18.5h17M4.5 18.5L3 8l5 4 4-6.5 4 6.5 5-4-1.5 10.5"/><circle cx="12" cy="4" r="1" fill="currentColor"/>',
  role_cyberpol: '<path d="M12 2.5l7.5 3v5.5c0 4.6-3.2 8.3-7.5 10-4.3-1.7-7.5-5.4-7.5-10V5.5z"/><circle cx="11" cy="11" r="3"/><path d="M13.2 13.2l2.6 2.6"/>',
  role_whitehat: '<path d="M2.5 17.5c3 1.5 16 1.5 19 0"/><path d="M6 17V9.5c0-2 2.7-3.5 6-3.5s6 1.5 6 3.5V17"/><path d="M6 13h12"/>',
  role_ripperdoc: '<path d="M18.5 3.5l2 2M16.5 5.5l2 2"/><path d="M19.5 4.5L9 15l-3-3L16.5 1.5"/><path d="M6 12l-3.5 3.5 1 1M9 15l-3.5 3.5"/><path d="M11 9l1.5 1.5M13 7l1.5 1.5"/>',
  role_host: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="M2.5 19c.5-3.5 2.2-5.5 4.5-5.5 1.6 0 2.9 1 3.7 2.6M21.5 19c-.5-3.5-2.2-5.5-4.5-5.5-1.6 0-2.9 1-3.7 2.6"/><path d="M10 16.5l2 2 2-2"/>',
  role_bodyguard: '<path d="M12 2.5l8 3v6c0 4.8-3.4 8.6-8 10-4.6-1.4-8-5.2-8-10v-6z"/><path d="M8.5 11.5l2.5 2.5 4.5-5"/>',
  role_watcher: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  role_dealer: '<rect x="3.5" y="5.5" width="10" height="14" rx="1.5" transform="rotate(-10 8.5 12.5)"/><rect x="10.5" y="4.5" width="10" height="14" rx="1.5" transform="rotate(10 15.5 11.5)"/><path d="M15.5 9.5l1.5 2-1.5 2-1.5-2z"/>',
  role_double: '<path d="M3 5c3 1.2 6 1.2 9 0v6.5c0 3-2 5-4.5 5S3 14.5 3 11.5z"/><path d="M12 8c3 1.2 6 1.2 9 0v6.5c0 3-2 5-4.5 5-1.6 0-3-.8-3.8-2.2"/><path d="M5.5 10h1.5M9 10h.5M14.5 13h1.5M18 13h.5M6 13.5c.8.6 2 .6 2.8 0M15 17c.8-.6 2-.6 2.8 0"/>',
  role_citizen: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c.8-4.2 3.5-6.5 7-6.5s6.2 2.3 7 6.5"/>',
  role_blade: '<path d="M20.5 3.5l-1.2 4.8-7.8 7.8-3.6-3.6 7.8-7.8z"/><path d="M5.5 10.5l8 8M7.8 16.2l-4.3 4.3"/>',
  role_netrunner: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 9l2.5 2L7 13M12 13h4M8 21h8M12 17v4"/>',
  role_doppelganger: '<circle cx="9" cy="9" r="5.5"/><path d="M15 3.8A5.5 5.5 0 0 1 15 14.2" stroke-dasharray="2 2"/><path d="M3 21c.6-3.2 2.9-5 6-5s5.4 1.8 6 5M17 16.2c2.1.5 3.5 2.2 4 4.8" />',
  role_viper: '<path d="M14 9.5c-3 0-4.5 1.5-4.5 3.2s1.8 2.8 4 3c2.3.2 4 1.4 4 3s-1.8 2.3-4.5 2.3H5"/><path d="M14 9.5c-1.8-.6-2.6-2-2.2-3.6.5-2 2.4-3 4.6-2.7 2.3.3 3.6 1.8 3.4 3.6-.2 1.9-2 3-4 2.9"/><circle cx="16.5" cy="6" r=".8" fill="currentColor"/><path d="M15 9.6v2.2M17.3 9.4v1.6"/>',
  role_fixer: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2M3 13h18M11 12v2h2v-2"/>',
  role_sponsor: '<path d="M8.5 6.5L7 3.5h10l-1.5 3"/><path d="M8.5 6.5C5 9 3.5 12.5 3.5 15.5c0 3 2.5 5 8.5 5s8.5-2 8.5-5c0-3-1.5-6.5-5-9z"/><path d="M14 11.5c-.5-.7-1.2-1-2-1-1.2 0-2 .6-2 1.5 0 2 4 1 4 3 0 .9-.8 1.5-2 1.5-.8 0-1.5-.3-2-1M12 9.5v1M12 16.5v1"/>',
  role_bounty: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  role_stowaway: '<path d="M3.5 8l8.5-4.5L20.5 8v9L12 21.5 3.5 17z"/><path d="M3.5 8L12 12.5 20.5 8M12 12.5v9"/><circle cx="9" cy="13.5" r=".8" fill="currentColor"/><circle cx="6.5" cy="12.3" r=".8" fill="currentColor"/>',

  // ----- 그 외 -----
  send: '<path d="M3.5 11.5L20.5 4l-7.5 17-2.5-7z"/><path d="M10.5 14L20.5 4"/>',
  back: '<path d="M10 6l-6 6 6 6M4 12h16"/>',
  bag: '<path d="M5 8h14l-1 12.5H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
};

// 아이콘 <svg> 만들기
function icon(name, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "ico" + (className ? " " + className : ""));
  svg.innerHTML = ICON_PATHS[name] || ICON_PATHS.appInfo; // 개발자가 직접 쓴 문자열만 넣음 (사용자 입력 아님)
  return svg;
}

// 직업 아이콘: roleIcon("blade")  (직업 id 기준)
function roleIcon(id, className) {
  return icon(ICON_PATHS["role_" + id] ? "role_" + id : "role_citizen", "role-ico" + (className ? " " + className : ""));
}

// HTML에 <i data-icon="moon"></i>처럼 적어두면 페이지가 열릴 때 아이콘으로 바꿔줌
function fillIcons(root) {
  for (const slot of (root || document).querySelectorAll("[data-icon]")) {
    if (slot.firstChild) continue;
    slot.appendChild(icon(slot.dataset.icon));
  }
}
