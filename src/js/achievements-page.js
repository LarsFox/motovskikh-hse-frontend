"use strict";

import {AchievementsApi, createAchievementsUI} from "./achievements.js";

const language = document.documentElement.lang || "ru";
createAchievementsUI({
  api: new AchievementsApi({baseURL: ""}),
  language,
  assetURL: (slug) => `/img/achievements/${slug}.svg`,
  mount: document.querySelector("#achievements-root") || document.body,
}).open();
