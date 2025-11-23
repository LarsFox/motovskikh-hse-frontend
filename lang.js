const year = new Date().getFullYear();

const lang = {
  lang: { en: "en", ru: "ru" },
  url: { en: "en/", ru: "" },
  href: { en: "/en/", ru: "/" },
  year: { en: year.toString(), ru: year.toString() },
  inWord: { en: "In English", ru: "По-русски" },
};

const ru = {};
const en = {};

function checkKeys(obj, ru, en) {
  if (typeof obj.ru === "string" && typeof obj.en === "string") {
    return obj;
  }
  if (Array.isArray(obj.ru) && Array.isArray(obj.en)) {
    return obj;
  }

  if (typeof obj.ru === "string" || typeof obj.en === "string") {
    console.log(`Missing key «${obj.ru}» “${obj.en}”`);
    return obj;
  }
  if (Array.isArray(obj.ru) || Array.isArray(obj.en)) {
    console.log(`Missing key «${obj.ru}» “${obj.en}”`);
    return obj;
  }

  for (let key in obj) {
    const text = checkKeys(obj[key], {}, {});
    ru[key] = text.ru;
    en[key] = text.en;
  }

  return {ru, en};
}

const i18n = {
  ru: { title: "En", abs: (url) => { return en.href + url; } },
  en: { title: "Ру", abs: (url) => { return url.slice(2); } },
};

checkKeys(lang, ru, en);

module.exports.i18n = i18n;
module.exports.langs = { en, ru };
