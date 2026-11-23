// VERMILION KEYS — procedural portraits (FIX ROUND 7).
// Circular SVG faces for the dialogue card and the crew cards. One
// function, deterministic per name: a small string hash picks the skin
// tone and hair colour from fixed palettes, so the same speaker always
// gets the same face. Each named speaker also gets one distinguishing
// item, readable at ~40 px: Marco a dark suit collar with a gold
// chain, Zia a driver headband, Kiki a lookout cap, Lo a mechanic
// cap. Unknown names get the generic face with no item. Everything is
// inline SVG — no assets, no network.

const SKINS = ['#e8b98a', '#c98d5f', '#f0c8a0', '#a06a42', '#d9a06a'];
const HAIRS = ['#1a1a20', '#3a2a1a', '#6a4a2a', '#8a8a8a', '#2a2a34', '#4a2a3a'];
const SHIRTS = ['#1a1a20', '#2a4a6a', '#3a2a4a', '#4a2a2a', '#2a5a4a'];

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick(arr, h, salt) {
  return arr[(h + salt) % arr.length];
}

// The distinguishing item, drawn over the hair/shoulders. Kept to a
// few bold shapes so it still reads at 40 px.
function itemSVG(name, skin, hair) {
  if (name === 'Marco') {
    // Dark suit collar + gold chain.
    return (
      '<path d="M14 44 L32 58 L50 44 L50 64 L14 64 Z" fill="#14141a"/>' +
      '<path d="M28 46 L32 58 L36 46 L32 50 Z" fill="#f5f5f5"/>' +
      '<path d="M22 48 Q32 60 42 48" fill="none" stroke="#fbbf24" stroke-width="2.5"/>'
    );
  }
  if (name === 'Zia') {
    // Driver headband — a vermilion band across the forehead.
    return '<path d="M18 26 Q32 18 46 26 L46 30 Q32 23 18 30 Z" fill="#ff6a4a"/>';
  }
  if (name === 'Kiki') {
    // Lookout cap — teal cap with a brim.
    return (
      '<path d="M16 26 Q16 12 32 12 Q48 12 48 26 L48 27 L16 27 Z" fill="#14a0b8"/>' +
      '<path d="M14 26 L50 26 L52 30 L12 30 Z" fill="#0d7a8a"/>'
    );
  }
  if (name === 'Lo') {
    // Mechanic cap — olive cap, brim forward, small wrench badge.
    return (
      '<path d="M16 26 Q16 12 32 12 Q48 12 48 26 L48 27 L16 27 Z" fill="#5a6a2a"/>' +
      '<path d="M14 26 L50 26 L52 30 L12 30 Z" fill="#46531f"/>' +
      '<circle cx="32" cy="19" r="3" fill="#fbbf24"/>'
    );
  }
  return '';
}

export function faceSVG(name) {
  const h = hashName(name || 'Runner');
  const skin = pick(SKINS, h, 0);
  const hair = pick(HAIRS, h, 3);
  const shirt = pick(SHIRTS, h, 7);
  const item = itemSVG(name, skin, hair);
  // 64x64, circular clip: face circle, hair cap, two eyes, a mouth,
  // shoulders in the speaker's shirt colour, then the item on top.
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="' + name + '">' +
    '<defs><clipPath id="vk-face-' + h + '"><circle cx="32" cy="32" r="30"/></clipPath></defs>' +
    '<g clip-path="url(#vk-face-' + h + ')">' +
    '<rect x="0" y="0" width="64" height="64" fill="#0b1120"/>' +
    '<path d="M10 64 Q10 48 32 48 Q54 48 54 64 Z" fill="' + shirt + '"/>' +
    '<circle cx="32" cy="30" r="15" fill="' + skin + '"/>' +
    '<path d="M17 30 Q17 12 32 12 Q47 12 47 30 Q47 22 40 19 Q32 15 24 19 Q17 22 17 30 Z" fill="' + hair + '"/>' +
    '<circle cx="26" cy="30" r="1.8" fill="#1a1a20"/>' +
    '<circle cx="38" cy="30" r="1.8" fill="#1a1a20"/>' +
    '<path d="M28 38 Q32 41 36 38" fill="none" stroke="#8a5a3a" stroke-width="1.6" stroke-linecap="round"/>' +
    item +
    '</g>' +
    '<circle cx="32" cy="32" r="30" fill="none" stroke="#fbbf24" stroke-width="2"/>' +
    '</svg>'
  );
}
