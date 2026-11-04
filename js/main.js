(function () {
  "use strict";

  var STAGE_QUERY = "(min-width: 1200px)";
  var pcMode = window.matchMedia(STAGE_QUERY).matches;
  var compactMode = !pcMode;      /* スマートフォン・タブレット(1199px以下)も、画面1枚ずつ切り替える */
  var stageMode = true;
  document.body.classList.add(pcMode ? "is-stage" : "is-compact");

  /* スマートフォン・タブレットの「縦長の画面」(#stage)の幅。スマートフォンでは、画面の幅と同じ */
  function colWidth() {
    var st = document.getElementById("stage");
    return (compactMode && st) ? st.getBoundingClientRect().width : window.innerWidth;
  }

  /* PC ⇄ タブレット幅をまたいだら、構成が変わるので読み込み直す */
  window.matchMedia(STAGE_QUERY).addEventListener("change", function (e) {
    if (e.matches !== pcMode) window.location.reload();
  });

  /* ------------------------------------------------------------------
     Loading screen (index.html only)
     ------------------------------------------------------------------ */
  function isLoaded() {
    var screen = document.getElementById("loadingScreen");
    return !screen || screen.classList.contains("is-hidden");
  }

  function initLoading() {
    var screen = document.getElementById("loadingScreen");
    if (!screen) return;

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      screen.classList.add("is-hidden");
      /* ローディング中にスクロール位置が復元されていても、画面が見えてから演出を始める */
      window.setTimeout(function () {
        document.dispatchEvent(new Event("teapot:loaded"));
        window.dispatchEvent(new Event("scroll"));
      }, 500);
    }

    screen.addEventListener("click", dismiss);
    window.setTimeout(dismiss, 3000);
  }


  /* ------------------------------------------------------------------
     Mobile nav toggle
     ------------------------------------------------------------------ */
  function initNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("siteNav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    /* メニューの外をタップしたら閉じる */
    document.addEventListener("click", function (e) {
      if (!nav.classList.contains("is-open") || nav.contains(e.target)) return;
      nav.classList.remove("is-open");
      toggle.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });

    nav.querySelectorAll(".nav-list a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.classList.remove("is-open");
      });
    });
  }


  /* ------------------------------------------------------------------
     ≤1199px: 縦に並べた表示（スクロールで順に現れる）
     ------------------------------------------------------------------ */
  function initAnchorScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href").slice(1);
        var target = id && document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", "#" + id);
      });
    });
  }

  function initReveal() {
    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    targets.forEach(function (el) { observer.observe(el); });
  }

  function initFlowExtras() {
    var sections = document.querySelectorAll("main > section[id]");
    if ("IntersectionObserver" in window) {
      var badge = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            document.body.classList.toggle("is-news-active", entry.target.getAttribute("id") === "news");
          });
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
      );
      sections.forEach(function (el) { badge.observe(el); });

      var hero = document.getElementById("newsOwls");
      if (hero) {
        var inView = false;
        var tryPlay = function () { if (inView && isLoaded()) hero.classList.add("is-playing"); };
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { inView = entry.isIntersecting; tryPlay(); });
        }, { threshold: .4 }).observe(hero);
        document.addEventListener("teapot:loaded", tryPlay);
      }
    }
  }

  /* ------------------------------------------------------------------
     PC: 絵本のように、画面1枚ごとに場面が切り替わる
     ------------------------------------------------------------------ */
  var SCENE_IDS = ["hero", "concept", "menu", "news", "map", "siteFooter"];

  function clamp01(n) { return Math.max(0, Math.min(1, n)); }
  function easeInOut(t) { return t * t * (3 - 2 * t); }
  function easeOutExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function trapezoid(p, a, b, c, d) {
    if (p <= a || p >= d) return 0;
    if (p < b) return (p - a) / (b - a);
    if (p <= c) return 1;
    return 1 - (p - c) / (d - c);
  }
  function wait(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }

  function initStage() {
    var scenes = SCENE_IDS.map(function (id) { return document.getElementById(id); });
    if (scenes.some(function (s) { return !s; })) return;

    var fxSteam = document.querySelector(".fx-steam");
    var fxCanopy = document.querySelector(".fx-canopy");
    var fxTrees = document.querySelector(".fx-trees");
    var fxFlash = document.querySelector(".fx-flash");
    var fxRise = document.querySelector(".fx-rise");
    var risePaper = document.querySelector(".fx-rise-paper");
    var riseOwl = document.querySelector(".fx-rise-owl");
    var riseOwlFrames = document.querySelectorAll(".rise-owl-frame");    var steamBg = document.querySelector(".fx-steam-bg");
    var steamLayers = document.querySelectorAll(".steam-layer");
    var canopyImg = document.querySelector(".fx-canopy-img");
    var treeL = document.querySelector(".trees-panel--left");
    var treeR = document.querySelector(".trees-panel--right");
    var menuStage = document.getElementById("menuStage");
    var heroBg = document.querySelector(".hero-bg");
    var heroFg = Array.prototype.slice.call(document.querySelectorAll(".hero-cloud, .hero-teaset, .hero-copy"));
    var newsHero = document.getElementById("newsOwls");
    var logo = document.getElementById("headerLogo");
    var logoColor = logo ? logo.getAttribute("src") : "";
    var logoWhite = "assets/images/logo/logo_WHT.png";

    var cur = 0;
    var busy = false;
    var enterTimer = null;
    var uiTimer = null;

    /* 1920x1080 のキャンバスの拡大率 */
    function setScale() {
      var kx = window.innerWidth / 1920, ky = window.innerHeight / 1080;
      var root = document.documentElement.style;
      root.setProperty("--k-contain", Math.min(kx, ky));
      /* スマートフォン・タブレットのMenu: 1080x2400 の絵が、画面にすべて収まる縮尺 */
      root.setProperty("--k-menu", Math.min(colWidth() / 1080, window.innerHeight / 2400));
      /* Map の背景は 1920x1146。画面を埋める（余白なし）縮尺 */
      var kc = Math.max(kx, window.innerHeight / 1146);
      root.setProperty("--k-cover", kc);
      /* 画面幅に比例（文字の大きさを他の場面とそろえる）。高さが足りないときだけ縮める */
      var vh = window.innerHeight;
      function fit(minH) {
        var k = Math.min(kx, vh / minH);
        return { k: k, h: Math.min(1080, vh / k) };
      }
      var news = fit(930), foot = fit(1000);
      root.setProperty("--k-news", news.k);
      root.setProperty("--ch-news", news.h + "px");
      root.setProperty("--k-foot", foot.k);
      root.setProperty("--ch-foot", foot.h + "px");
      /* Map: 背景に合わせた縮尺(k-cover)のままでも、文字は画面幅に比例させる */
      root.setProperty("--tx-map", kx / kc);
      /* サブコピーの位置: タイトルから約16px（1920px幅のとき。画面幅に比例） */
      var vw = window.innerWidth;
      var titleBottom = vw * (0.026 + 0.03125);
      var gapTopV = vw * 0.008333;
      var offNews = (vh - news.h * news.k) / 2;
      root.setProperty("--news-lead-top", ((titleBottom - offNews) / news.k + gapTopV / news.k) + "px");
      var offMap = (vh - 1146 * kc) / 2;
      root.setProperty("--map-copy-top", ((titleBottom + gapTopV - offMap) / kc) + "px");
    }
    setScale();
    window.addEventListener("resize", setScale);

    function setChrome(visibleIdx) {
      if (logo && !compactMode) {
        var src = visibleIdx === 2 ? logoWhite : logoColor;
        if (logo.getAttribute("src") !== src) logo.setAttribute("src", src);
      }
      document.body.classList.toggle("is-hero-active", visibleIdx === 0);   /* Heroでは、動物の数ではなく「森の動物と隠れんぼ」と出す */
      document.body.classList.toggle("is-news-active", visibleIdx === 3);
      document.body.classList.toggle("is-footer-active", visibleIdx === 5);
    }

    function showOnly(idx) {
      scenes.forEach(function (s, i) { s.classList.toggle("is-current", i === idx); });
    }

    function setFx(el, on) { el.classList.toggle("is-on", on); }

    /* スマートフォン・タブレット: 面に入ったとき、中身をふわっと見せる（PCの is-entered に相当） */
    function showReveals(i, on) {
      if (!compactMode) return;
      scenes[i].querySelectorAll(".reveal").forEach(function (el) { el.classList.toggle("is-visible", on); });
      if (on) scenes[i].scrollTop = 0;
    }

    function resetScene(i) {
      showReveals(i, false);
      scenes[i].classList.remove("is-entered", "is-ui", "is-blurred", "is-sliding");
      scenes[i].style.transform = "";
      scenes[i].style.zIndex = "";
      if (i === 2 && menuStage) menuStage.classList.remove("is-playing");
      if (i === 3 && newsHero) newsHero.classList.remove("is-playing");
    }

    function enterScene(i, delay) {
      window.clearTimeout(enterTimer);
      window.clearTimeout(uiTimer);
      enterTimer = window.setTimeout(function () {
        if (cur !== i) return;
        scenes[i].classList.add("is-entered");
        showReveals(i, true);
        if (i === 3 && newsHero) newsHero.classList.add("is-playing");
        if (i === 2) {
          /* タイトルとウサギがすぐ始まり、少しあとに石板のメニューが現れる */
          if (menuStage) menuStage.classList.add("is-playing");
          uiTimer = window.setTimeout(function () {
            if (cur === 2) scenes[2].classList.add("is-ui");
          }, compactMode ? 2300 : 1800);   /* スマートフォン・タブレットは、ウサギが走って消える(2.2秒)のを待つ */
        }
      }, delay);
    }
    function tween(ms, from, to, fn) {
      return new Promise(function (resolve) {
        var start = null;
        function frame(now) {
          if (start === null) start = now;
          var u = clamp01((now - start) / ms);
          fn(from + (to - from) * u);
          if (u < 1) window.requestAnimationFrame(frame);
          else resolve();
        }
        window.requestAnimationFrame(frame);
      });
    }

    /* ---- 各場面の切り替え: apply(p) は p=0 で前の場面、p=1 で次の場面 ---- */
    var STEAM_STOPS = [[0, .1, .25, .45], [.1, .2, .4, .6], [.3, .45, .55, .75], [.45, .55, .7, .95]];

    var transitions = [
      /* 0: Hero -> Concept
         ①背景(Top.jpg)が薄くなって消える → ②ほかの要素(吹き出し・ティーセット・文字)が薄くなり、湯気(yuge00)が現れる
         → ③湯気が広がって、コンセプトが現れる */
      {
        dur: 4800,
        apply: function (p) {
          var tFade = clamp01(p / .17);                 /* ① 背景 */
          var fgFade = clamp01((p - .15) / .2);          /* ② ほかの要素 */
          heroBg.style.opacity = 1 - tFade;
          heroFg.forEach(function (el) { el.style.opacity = 1 - fgFade; });
          var q = clamp01((p - .2) / .8);                /* ③ 湯気 */
          setFx(fxSteam, p > 0 && p < 1);
          steamBg.style.opacity = q < .5 ? clamp01(q / .3) : 1 - clamp01((q - .65) / .35);
          steamLayers.forEach(function (layer, i) {
            var s = STEAM_STOPS[i];
            layer.style.opacity = trapezoid(q, s[0], s[1], s[2], s[3]);
            layer.style.transform = "translate(-50%, -50%) scale(" + (.4 + q * .9) + ")";
          });
          var top = q >= .55 ? 1 : 0;
          showOnly(top);
          setChrome(top);
        }
      },      /* 1: Concept -> Menu 木立が上から被さり、ぼけた背景が鮮明になる */
      {
        dur: 3000,
        apply: function (p) {
          setFx(fxCanopy, p > 0 && p < 1);
          canopyImg.style.clipPath = "inset(0 0 " + (1 - easeInOut(clamp01(p / .35))) * 100 + "% 0)";
          var inMenu = p >= .4;
          showOnly(inMenu ? 2 : 1);
          setChrome(inMenu ? 2 : 1);
          var settle = p >= .55;
          fxCanopy.classList.toggle("is-dissolving", settle);
          scenes[2].classList.toggle("is-blurred", !settle);
          if (p >= 1) { setFx(fxCanopy, false); }
        }
      },
      /* 2: Menu -> News 右から勢いよくスライドイン */
      {
        dur: 1100,
        apply: function (p) {
          var e = easeOutExpo(p);
          showOnly(2);
          scenes[2].classList.add("is-current");
          scenes[3].classList.toggle("is-current", p > 0);
          scenes[3].classList.toggle("is-sliding", p > 0 && p < 1);
          scenes[3].style.zIndex = 5;
          scenes[3].style.transform = "translateX(" + (1 - e) * 100 + "%)";
          setChrome(p >= .5 ? 3 : 2);
        }
      },
      /* 3: News -> Map 木々が下から上がり、左右に開く */
      {
        dur: 2400,
        apply: function (p) {
          setFx(fxTrees, p > 0 && p < 1);
          var rise = easeInOut(clamp01(p / .4));
          var part = easeInOut(clamp01((p - .55) / .45));
          fxTrees.style.transform = "translateY(" + (1 - rise) * 100 + "%)";
          treeL.style.transform = "translateX(" + (-part * 100) + "%)";
          treeR.style.transform = "translateX(" + (part * 100) + "%)";
          var top = p >= .47 ? 4 : 3;
          /* Mapの背景は、木々が割れるころ、Newsの上に、縮小せずに、下からすっと上がってくる */
          var u = clamp01((p - .47) / .4);
          var lift = 1 - Math.pow(1 - u, 3);
          showOnly(3);
          if (p >= .47) scenes[4].classList.add("is-current");
          scenes[4].style.transform = "translateY(" + (1 - lift) * 100 + "%)";
          if (u >= 1) showOnly(4);
          setChrome(top);
        }
      },
      /* 4: Map -> Footer 一瞬白く光る */
      { dur: 800, apply: flashApply(4, 5) }
    ];

    /* ---- スマートフォン・タブレット: 基本はホワイトアウト。Hero → Concept だけ、湯気の演出 ---- */
    var steamSp = Array.prototype.slice.call(document.querySelectorAll(".steam-sp"));
    /* 各コマの [現れ始め, 完全に見える, 見えなくなり始め, 消える] （全体を0〜1として） */
    var SP_STOPS = [[.06, .18, .30, .42], [.30, .42, .52, .64], [.50, .60, .70, .82], [.68, .78, .90, 1.0]];

    var compactTransitions = [
      {
        dur: 4600,
        apply: function (p) {
          /* ①Heroがすっと薄れて、②ポットと湯気のコマが進み（小さいまま）、③最後は全面の湯気がほどけてConceptが現れる */
          var hf = clamp01(p / .2);
          heroBg.style.opacity = 1 - hf;
          heroFg.forEach(function (el) { el.style.opacity = 1 - hf; });
          setFx(fxSteam, p > 0 && p < 1);
          steamBg.style.opacity = p < .9 ? clamp01(p / .12) : 1 - clamp01((p - .9) / .1);
          steamSp.forEach(function (el, i) {
            var s = SP_STOPS[i];
            el.style.opacity = trapezoid(p, s[0], s[1], s[2], s[3]);
          });
          var top = p >= .8 ? 1 : 0;
          showOnly(top);
          setChrome(top);
        }
      },
      transitions[1],   /* Concept → Menu: PCと同じ（木立が上から被さる） */
      /* Menu → News: 紙色の面が下から一直線にせり上がる（その手前を、小さなフクロウが右下から斜め左上へ飛び去る）
         → 覆い終えたらNewsに替わる（そのあと、Newsの中で、左から右へフクロウが飛んでくる） */
      {
        dur: 2000,
        apply: function (p) {
          var H = window.innerHeight, W = colWidth();
          var e = easeInOut(clamp01(p / .62));
          setFx(fxRise, p > 0 && p < 1);
          fxRise.style.opacity = 1 - clamp01((p - .8) / .2);
          risePaper.style.transform = "translateY(" + (1 - e) * 100 + "%)";
          /* フクロウ: 右下の外 → 左上の外へ、約25°の上り坂 */
          var u = clamp01((p - .04) / .6);
          var ow = riseOwl.offsetWidth || W * .26;
          var x0 = W + ow * .2, x1 = -ow * 1.2;
          var x = x0 + (x1 - x0) * u;
          var y = H * .88 - (x0 - x) * Math.tan(25 * Math.PI / 180);
          riseOwl.style.opacity = trapezoid(u, 0, .08, .92, 1);
          riseOwl.style.transform = "translate(" + x + "px," + y + "px)";
          var fi = Math.floor(u * 9) % 3;
          riseOwlFrames.forEach(function (img, i) { img.style.opacity = i === fi ? 1 : 0; });
          var top = p >= .62 ? 3 : 2;
          showOnly(top);
          setChrome(top);
        }
      },      transitions[3],   /* News → Map: PCと同じ（木々が下から上がり、左右に割れてMapが現れる。木はSP用の絵） */
      { dur: 800, apply: flashApply(4, 5) }
    ];

    var flashFrom = 0, flashTo = 0;
    function flashApply(a, b) {
      return function (p) {
        var f = p < .4 ? p / .4 : 1 - (p - .4) / .6;
        setFx(fxFlash, p > 0 && p < 1);
        fxFlash.style.opacity = clamp01(f);
        var top = p >= .4 ? b : a;
        showOnly(top);
        setChrome(top);
      };
    }

    function updateHash(i) {
      try { history.replaceState(null, "", "#" + SCENE_IDS[i]); } catch (e) { /* ignore */ }
    }

    function clearFx() {
      [fxSteam, fxCanopy, fxTrees, fxFlash, fxRise].forEach(function (el) { setFx(el, false); });
      fxCanopy.classList.remove("is-dissolving");
      fxTrees.style.transform = "";
      scenes[3].style.transform = "";
      scenes[3].style.zIndex = "";
      scenes[3].classList.remove("is-sliding");
      scenes[4].style.transform = "";
      heroBg.style.opacity = "";
      heroFg.forEach(function (el) { el.style.opacity = ""; });
      steamSp.forEach(function (el) { el.style.opacity = ""; });
      steamBg.style.opacity = "";
      scenes[0].classList.remove("is-leaving");
    }

    async function goTo(target) {
      if (busy || target === cur || target < 0 || target >= scenes.length) return;
      busy = true;
      window.clearTimeout(enterTimer);
      var from = cur;
      var dir = target > from ? 1 : -1;
      var adjacent = Math.abs(target - from) === 1;
      var k = Math.min(from, target);

      /* 最初にHeroを離れるとき: 湯気の切り替え中だけ「↓START！」。そのあとは、Heroに戻っても「見つけた動物」 */
      if (from === 0 && !document.body.classList.contains("has-started")) {
        document.body.classList.add("has-started");
        if (adjacent && target === 1) document.body.classList.add("is-starting");
      }

      /* 去る場面の中身はその場で片づけ、行き先の下準備をする */
      if (adjacent && k === 0) {
        /* Hero <-> Concept: Heroの中身は、切り替えの演出で順に消える（その場では片づけない） */
        scenes[0].classList.add("is-entered", "is-leaving");
        showReveals(0, true);
        resetScene(1);
      } else if (compactMode && adjacent && from === 2 && dir === 1) {
        /* Menu → News: 湯気が覆い終わるまで、Menuはそのまま見せる（切り替えのあとで片づく） */
        resetScene(target);
      } else {
        resetScene(from);
        resetScene(target);
      }
      var settledMenu = false;
      if (adjacent && k === 2 && dir === -1) {
        /* News -> Menu: Menuはすでに整った状態で戻る */
        scenes[2].classList.add("is-entered", "is-ui");
        if (menuStage) menuStage.classList.add("is-playing");
        settledMenu = true;
      }
      if (target === 2 && !settledMenu) scenes[2].classList.add("is-blurred");

      if (adjacent) {
        var tr = (compactMode ? compactTransitions : transitions)[k];
        if (dir === 1) await tween(tr.dur, 0, 1, tr.apply);
        else await tween(tr.dur, 1, 0, tr.apply);
      } else {
        var fn = flashApply(from, target);
        await tween(800, 0, 1, fn);
      }

      clearFx();
      document.body.classList.remove("is-starting");
      cur = target;
      showOnly(cur);
      setChrome(cur);
      scenes.forEach(function (s, i) { if (i !== cur) resetScene(i); });
      if (cur === 2 && !settledMenu) {
        scenes[2].classList.remove("is-blurred");
        enterScene(cur, 0);
      } else if (!settledMenu) {
        enterScene(cur, 150);
      } else {
        scenes[2].classList.add("is-entered", "is-ui");
      }
      updateHash(cur);
      busy = false;
      lockedUntil = Date.now() + 450;
    }

    /* ---- 入力: ホイール / キー / タッチ / ナビ ---- */
    var lockedUntil = 0;
    var lastWheel = 0;
    var gestureUsed = false;
    var wheelAcc = 0;
    var WHEEL_THRESHOLD = 400; /* マウスのホイール約6クリック分。大きいほど長くスクロールが必要 */

    function popupOpen() {
      var modal = document.getElementById("menuModal");
      var siteNav = document.getElementById("siteNav");   /* スマートフォンのメニュー(モーダル)が開いているあいだは、場面を切り替えない */
      return document.body.classList.contains("is-animal-open") || (modal && modal.classList.contains("is-open")) ||
        (siteNav && siteNav.classList.contains("is-open") && compactMode);
    }
    function step(d) {
      if (!isLoaded() || popupOpen()) return;
      goTo(cur + d);
    }

    /* 面の中身が長いとき（タブレット以下）、その方向にまだスクロールできるか */
    function sceneCanScroll(down) {
      var s = scenes[cur];
      /* Menuのように、中身をはみ出して置いていても、スクロールしない面(overflow:hidden)は、ここでは対象外 */
      if (window.getComputedStyle(s).overflowY === "hidden") return false;
      return down ? s.scrollTop + s.clientHeight < s.scrollHeight - 1 : s.scrollTop > 1;
    }

    window.addEventListener("wheel", function (e) {
      if (popupOpen()) return;
      /* タブレット以下: 面の中は普通にスクロール。端まで来たら、さらに回すと、次の面へ */
      if (compactMode && sceneCanScroll(e.deltaY > 0)) { wheelAcc = 0; return; }
      e.preventDefault();
      var now = Date.now();
      var gap = now - lastWheel;
      lastWheel = now;
      if (gap > 160) gestureUsed = false;
      if (gap > 400 || (wheelAcc && (wheelAcc > 0) !== (e.deltaY > 0))) wheelAcc = 0;
      if (gestureUsed || busy || now < lockedUntil) return;
      /* ある程度スクロールしてから切り替わるよう、移動量をためる */
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < WHEEL_THRESHOLD) return;
      var d = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      gestureUsed = true;
      step(d);
    }, { passive: false });

    window.addEventListener("keydown", function (e) {
      if (busy || popupOpen()) return;
      var k = e.key;
      var down = k === "ArrowDown" || k === "PageDown" || k === " ";
      var up = k === "ArrowUp" || k === "PageUp";
      if (compactMode && (down || up) && sceneCanScroll(down)) return;   /* 面の中は普通にスクロール */
      if (down) { e.preventDefault(); step(1); }
      else if (up) { e.preventDefault(); step(-1); }
      else if (k === "Home") { e.preventDefault(); step(-cur); }
      else if (k === "End") { e.preventDefault(); step(scenes.length - 1 - cur); }
    });

    var tx = null, ty = null;
    var atTop = true, atBottom = true;   /* スワイプを始めたとき、いまの面のスクロールが端にあったか */
    window.addEventListener("touchstart", function (e) {
      tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
      atTop = !sceneCanScroll(false);
      atBottom = !sceneCanScroll(true);
    }, { passive: true });
    window.addEventListener("touchend", function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      var dy = e.changedTouches[0].clientY - ty;
      tx = ty = null;
      if (Math.abs(dy) > 120 && Math.abs(dy) > Math.abs(dx)) {
        /* 面の中身が長いときは、上端・下端まで来てから、次の面へ切り替わる */
        if (dy < 0 && (!compactMode || atBottom)) step(1);
        else if (dy > 0 && (!compactMode || atTop)) step(-1);
      }
    }, { passive: true });

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href").slice(1);
        var idx = SCENE_IDS.indexOf(id);
        if (idx === -1) return;
        e.preventDefault();
        if (!isLoaded() || popupOpen()) return;
        goTo(idx);
      });
    });

    /* ---- 開始: URLのハッシュに合わせて最初の場面を決める ---- */
    var hashIdx = SCENE_IDS.indexOf(window.location.hash.slice(1));
    if (hashIdx > 0) { cur = hashIdx; document.body.classList.add("has-started"); }
    showOnly(cur);
    setChrome(cur);
    var started = false;
    function start() {
      if (started) return;
      started = true;
      if (cur === 2) {
        scenes[2].classList.add("is-blurred");
        window.setTimeout(function () { scenes[2].classList.remove("is-blurred"); enterScene(2, 0); }, 60);
      } else {
        enterScene(cur, 100);
      }
    }
    if (isLoaded()) start();
    else document.addEventListener("teapot:loaded", start);

    /* 検証・デバッグ用 */
    window.__stage = { goTo: goTo, state: function () { return { cur: cur, busy: busy }; } };
  }

  /* ------------------------------------------------------------------
     Menu: swipeable stone-tablet carousel + rabbit run-in
     ------------------------------------------------------------------ */
  function initMenuCarousel() {
    var stage = document.getElementById("menuStage");
    var wrap = document.getElementById("menuTabletWrap");
    var slides = document.querySelectorAll("#menuSlides .menu-slide");
    var dotsWrap = document.getElementById("menuDots");
    var flash = document.getElementById("menuFlash");
    var prevBtn = document.getElementById("menuPrev");
    var nextBtn = document.getElementById("menuNext");
    if (!stage || !wrap || !slides.length || !dotsWrap) return;

    var current = 0;
    var dots = [];

    slides.forEach(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "menu-dot" + (i === 0 ? " is-active" : "");
      dot.setAttribute("aria-label", "メニュー " + (i + 1));
      dot.addEventListener("click", function () { goTo(i); });
      dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    function goTo(index) {
      var next = (index + slides.length) % slides.length;
      if (next === current) return;
      current = next;

      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === current);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === current);
      });

      if (flash) {
        flash.classList.remove("is-flashing");
        void flash.offsetWidth;
        flash.classList.add("is-flashing");
      }
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(current + 1); });

    wrap.addEventListener("click", function (e) {
      if (e.target.closest(".menu-nav, .menu-dot, .menu-animal")) return;
      var rect = wrap.getBoundingClientRect();
      var x = e.clientX - rect.left;
      if (x < rect.width / 3) goTo(current - 1);
      else if (x > (rect.width * 2) / 3) goTo(current + 1);
    });

    var touchStartX = null;
    wrap.addEventListener("touchstart", function (e) {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    wrap.addEventListener("touchend", function (e) {
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? current + 1 : current - 1);
      touchStartX = null;
    }, { passive: true });

    if ("IntersectionObserver" in window) {
      var inView = false;
      var tryPlay = function () {
        /* 1200px以上は木立の切り替えの流れ(initConceptPathTransition)が再生を管理する */
        if (window.matchMedia("(min-width: 1200px)").matches) return;
        if (inView && isLoaded()) stage.classList.add("is-playing");
      };
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            inView = entry.isIntersecting;
            tryPlay();
          });
        },
        { threshold: .4 }
      );
      observer.observe(stage);
      document.addEventListener("teapot:loaded", tryPlay);
    } else {
      stage.classList.add("is-playing");
    }
  }


  /* ------------------------------------------------------------------
     かくれている動物（場面ごとに1匹）: 見つけたらクリックでポップアップ＋カウント
     ------------------------------------------------------------------ */
  var ANIMAL_STORAGE_KEY = "mahouTeapot.foundAnimals";

  function getFoundAnimals() {
    try {
      var raw = window.localStorage.getItem(ANIMAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFoundAnimals(list) {
    try {
      window.localStorage.setItem(ANIMAL_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      /* localStorage unavailable: ignore, game just won't persist */
    }
  }

  function updateAnimalCount() {
    var counter = document.getElementById("rabbitCountMain");
    if (!counter) return;
    var total = document.querySelectorAll(".hidden-animal").length;
    counter.textContent = "🐾 見つけた動物 " + getFoundAnimals().length + "/" + total;
  }

  /* 耳や尻尾だけをひょっこり出す → しばらく見せる → ひっこめる、を繰り返す（場面にいるあいだだけ） */
  var TEASE_SHOW = 8000;   /* 出ている時間(ms) */
  var TEASE_HIDE = 3500;   /* 引っ込んでいる時間(ms) */

  function teaseLoop(el, index) {
    var scene = el.closest(".scene");
    if (!scene) return;
    var showing = false;
    var lastChange = 0;
    /* 場面に入ってから最初に出るまで（同じ場面の動物どうしは、ずらす） */
    var local = Array.prototype.indexOf.call(scene.querySelectorAll(".hidden-animal"), el);
    var wait = 2500 + Math.max(0, local) * 3600;
    window.setInterval(function () {
      var now = Date.now();
      if (!scene.classList.contains("is-entered")) {
        showing = false;
        el.__everShown = false;
        el.classList.remove("is-tease");
        lastChange = now;
        return;
      }
      if (!lastChange) lastChange = now;
      var span = showing ? TEASE_SHOW : (lastChange && el.__everShown ? TEASE_HIDE : wait);
      if (now - lastChange >= span) {
        showing = !showing;
        el.classList.toggle("is-tease", showing);
        if (showing) el.__everShown = true;
        lastChange = now;
      }
    }, 300);
  }
  function initHiddenAnimals() {
    updateAnimalCount();

    var animals = document.querySelectorAll(".hidden-animal");
    var dim = document.getElementById("animalDim");
    var wrap = document.getElementById("animalWrap");
    var spotImg = document.getElementById("animalSpotImg");
    var bubble = document.getElementById("animalBubble");
    var nameEl = document.getElementById("animalName");
    var descEl = document.getElementById("animalDesc");
    var foundEl = document.getElementById("animalFound");
    var closeBtn = document.getElementById("animalClose");
    if (!animals.length || !dim || !wrap || !bubble) return;

    var current = null;   /* いま飛び出している動物 { el, from } */
    var closing = false;
    var OPEN_EASE = "cubic-bezier(.3, 1.35, .5, 1)";

    /* クリック（タップ）: 動物が全身で飛び出し、まわりが暗くなり、動物のそばに吹き出しが出る（PCもスマートフォンも同じ） */
    function openAnimal(el) {
      if (current || closing) return;
      var img = el.querySelector("img");
      /* いまの(のぞいている)位置と、飛び出したあとの位置 */
      var from = el.getBoundingClientRect();
      var prevTransition = el.style.transition;
      var prevTransform = el.style.transform;
      el.style.transition = "none";
      el.style.transform = "translate(0, 0)";
      var rect = el.getBoundingClientRect();
      el.style.transform = prevTransform;
      void el.offsetWidth;
      el.style.transition = prevTransition;

      var id = el.getAttribute("data-animal-id");
      var isNew = false;
      if (id) {
        var found = getFoundAnimals();
        if (found.indexOf(id) === -1) { found.push(id); saveFoundAnimals(found); isNew = true; }
      }
      updateAnimalCount();

      spotImg.src = el.getAttribute("data-animal-img") || (img && img.src) || "";
      spotImg.style.transform = img ? window.getComputedStyle(img).transform : "none";   /* 左右の向きも、同じにする */
      wrap.style.left = rect.left + "px";
      wrap.style.top = rect.top + "px";
      wrap.style.width = rect.width + "px";
      wrap.style.height = rect.height + "px";
      nameEl.textContent = el.getAttribute("data-animal-name") || "動物";
      descEl.textContent = el.getAttribute("data-animal-desc") || "";
      var total = document.querySelectorAll(".hidden-animal").length;
      foundEl.textContent = (isNew ? "🐾 はじめて見つけた！\n" : "🐾 ") + "見つけた動物 " + getFoundAnimals().length + "/" + total;

      el.style.opacity = "0";   /* 元の動物は隠し、手前の動物と入れ替える */
      document.body.classList.remove("is-animal-closing");
      document.body.classList.add("is-animal-open");
      current = { el: el, dx: from.left - rect.left, dy: from.top - rect.top, rect: rect };
      wrap.animate([
        { transform: "translate(" + current.dx + "px, " + current.dy + "px)" },
        { transform: "translate(0, 0)" }
      ], { duration: 650, easing: OPEN_EASE, fill: "both" });

      placeBubble(rect);
      window.setTimeout(function () { if (current) { bubble.classList.add("is-show"); if (closeBtn) closeBtn.focus({ preventScroll: true }); } }, 350);
    }

    /* 吹き出しは、動物の、空いている側（右 → 左 → 上）に出す */
    function placeBubble(rect) {
      var W = window.innerWidth, H = window.innerHeight;
      var spaceR = W - rect.right, spaceL = rect.left;
      var side, bw;
      if (spaceR >= 190) { side = "r"; bw = Math.min(300, spaceR - 24); }
      else if (spaceL >= 190) { side = "l"; bw = Math.min(300, spaceL - 24); }
      else { side = "t"; bw = Math.min(300, W - 32); }
      bubble.className = "animal-bubble is-" + side;
      bubble.style.width = bw + "px";
      var bh = bubble.offsetHeight;
      var left, top;
      if (side === "r") { left = rect.right + 14; top = Math.min(Math.max(rect.top + rect.height * .1, 12), H - bh - 12); }
      else if (side === "l") { left = rect.left - 14 - bw; top = Math.min(Math.max(rect.top + rect.height * .1, 12), H - bh - 12); }
      else {
        left = Math.min(Math.max(rect.left + rect.width / 2 - bw / 2, 12), W - bw - 12);
        top = Math.max(12, rect.top - bh - 16);
        bubble.style.setProperty("--tail-x", (rect.left + rect.width / 2 - left) + "px");
      }
      bubble.style.left = left + "px";
      bubble.style.top = top + "px";
    }

    function closeAnimal() {
      if (!current || closing) return;
      closing = true;
      var cur = current;
      bubble.classList.remove("is-show");
      document.body.classList.remove("is-animal-open");
      document.body.classList.add("is-animal-closing");
      var back = wrap.animate([
        { transform: "translate(0, 0)" },
        { transform: "translate(" + cur.dx + "px, " + cur.dy + "px)" }
      ], { duration: 380, easing: "ease-in", fill: "both" });
      back.onfinish = function () {
        cur.el.style.opacity = "";
        document.body.classList.remove("is-animal-closing");
        current = null;
        closing = false;
      };
    }

    animals.forEach(function (el, index) {
      el.addEventListener("click", function () { openAnimal(el); });
      teaseLoop(el, index);
    });
    dim.addEventListener("click", closeAnimal);
    if (closeBtn) closeBtn.addEventListener("click", closeAnimal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAnimal(); });
    window.addEventListener("resize", function () { if (current) closeAnimal(); });
  }
  /* ------------------------------------------------------------------
     Hero: たまに画面の端から、動物がこちらをのぞく（PCのみ。Heroにいるあいだだけ）
     ちらっとのぞいてすぐ隠れる → すぐまた現れて2〜3秒こちらを見る → 消える
     ------------------------------------------------------------------ */
  /* w: 1920px幅のときの幅(px) / ears: 最初にポンっと出す、耳や頭の高さ(動物の高さに対する割合)
     face: 絵の向き("R"=右向き / "L"=左向き)。画面の中央を向くように、出る場所に合わせて反転する */
  var PEEKERS = [
    { src: "assets/images/characters/animals/usagi.png", w: 210, ears: .24, face: "R" },
    { src: "assets/images/characters/animals/tanuki.png", w: 220, ears: .14, face: "L" },
    { src: "assets/images/characters/animals/risu.png", w: 150, ears: .2, up: 68, out: 32, face: "R" },
    { src: "assets/images/characters/animals/inoshishi.png", w: 290, ears: .14, face: "R" },
    { src: "assets/images/characters/animals/shika.png", w: 310, ears: .17, face: "R", spOut: 36 }
  ];
  /* ティーセット(TeaSet.png)の向こう側。中央のティーポットは避ける。
     TEA_EDGE: 台紙(1920x1080)の x=32,52,72… (20px刻み)で、ティーセットが最初に現れる高さ(px)。
     動物が隠れる位置は、動物の幅の範囲でいちばん低い縁にそろえる（はみ出して見えないように） */
  var TEA_EDGE = [964,902,876,857,842,827,815,803,792,783,775,765,757,751,745,739,731,726,705,652,643,632,553,583,553,627,634,644,655,682,679,511,506,500,516,548,600,628,633,597,505,497,485,475,330,349,387,382,346,330,475,485,498,506,551,532,510,500,496,494,508,526,568,676,679,682,685,687,689,692,696,690,683,680,678,677,677,677,679,681,684,688,694,705,722,718,728,801,813,826,840,856,874,902];
  var BEHIND_X = [250, 650, 1200, 1720];   /* 動物の中心(px)の候補 */

  function edgeBetween(x0, x1) {
    var worst = 0;
    for (var x = Math.max(32, x0); x <= x1; x += 20) {
      var v = TEA_EDGE[Math.round((x - 32) / 20)];
      if (v && v > worst) worst = v;
    }
    return worst || 700;
  }
  function initHeroWalkers() {
    var hero = document.getElementById("hero");
    var canvas = hero && hero.querySelector(".hero-canvas");
    var teaset = hero && hero.querySelector(".hero-teaset");
    if (!hero || !canvas || !teaset) return;
    var current = null;
    var timer = null;
    var lastSpot = -1;

    function stop() {
      window.clearTimeout(timer);
      if (current) { current.remove(); current = null; }
    }

    function heroActive() {
      return hero.classList.contains("is-current") && hero.classList.contains("is-entered") && !hero.classList.contains("is-leaving");
    }

    function schedule(delay) {
      window.clearTimeout(timer);
      timer = window.setTimeout(peek, delay);
    }

    function rand(min, max) { return min + Math.random() * (max - min); }

    function peek() {
      if (!heroActive() || document.hidden || current) { schedule(4000); return; }
      var a = PEEKERS[Math.floor(Math.random() * PEEKERS.length)];
      var el = document.createElement("div");
      el.className = "hero-walker";
      var img = document.createElement("img");
      img.src = a.src;
      img.alt = "";
      el.appendChild(img);

      var hidden, ears, face;       /* 隠れている / 耳だけ(ポンっ) / 顔と胸元まで(席に着いた) */
      if (!compactMode && Math.random() < .72) {
        /* メイン: ティーセットの向こう側から。縁の高さに合わせて、下から せり上がる */
        var i;
        do { i = Math.floor(Math.random() * BEHIND_X.length); } while (i === lastSpot && BEHIND_X.length > 1);
        lastSpot = i;
        var cx = Math.max(BEHIND_X[i], 70 + a.w / 2);   /* 左端の、ティーセットが無い部分にはみ出さない */
        el.style.width = (a.w / 19.2) + "%";
        el.style.left = ((cx - a.w / 2) / 19.2) + "%";
        el.style.top = (edgeBetween(cx - a.w / 2, cx + a.w / 2) / 10.8) + "%";
        hidden = "translateY(0%)";
        ears = "translateY(-" + Math.round(a.ears * 100) + "%)";
        face = "translateY(-" + (a.up || 54) + "%)";   /* 顔と胸元が出る高さ(%)。リスは高めに */
        /* テーブルの左側に出るときは、全員、反転させる（右側は元の向き） */
        if (cx < 960) img.style.transform = "scaleX(-1)";
        canvas.insertBefore(el, teaset);
      } else {
        /* おまけ: 画面の左右の端、下半分から。こちらをのぞく */
        /* スマートフォン・タブレットは、左・右・下から（下は、右下のフクロウのバッジを避ける） */
        var kind = compactMode ? ["left", "right", "bottom"][Math.floor(Math.random() * 3)] : (Math.random() < .5 ? "right" : "left");
        var right = kind === "right";
        el.classList.add("hero-walker--edge");
        el.style.width = (compactMode ? a.w / 7 : a.w / 19.2) + (compactMode ? "cqw" : "vw");
        el.style.top = (compactMode ? rand(28, 64) : rand(52, 74)) + "vh";
        /* 斜めに傾けて、体は画面の外に置いたまま、顔だけを内側へのぞかせる。右端は全員反転（左端は元の向き） */
        var out = (compactMode && a.spOut) || a.out || 60;   /* スマートフォン・タブレットは、大きい動物(シカ)の出る量を控えめに */   /* 顔を出す量(%)。小さい動物は多めに */
        if (kind === "bottom") {
          var colRect = document.getElementById("stage").getBoundingClientRect();
          var wpx = colRect.width * a.w / 7 / 100;
          var badge = document.querySelector(".notice-badge");
          var free = colRect.width;
          if (badge && document.getElementById("stage").contains(badge)) free = Math.min(free, badge.getBoundingClientRect().left - colRect.left);   /* 左右の余白にバッジがあるときは、避けなくてよい */
          free -= 14;
          wpx = Math.min(wpx, Math.max(60, free));   /* バッジにかからない幅に収める */
          el.style.width = wpx + "px";
          el.style.top = "auto";
          el.style.bottom = "0";
          el.style.left = rand(8, Math.max(8, free - wpx)) + "px";
          hidden = "translateY(100%)"; ears = "translateY(" + (100 - a.ears * 100) + "%)"; face = "translateY(" + (100 - (a.up || 54)) + "%)";
        } else if (right) {
          el.style.right = "0";
          img.style.transform = "scaleX(-1)";
          hidden = "translateX(140%) rotate(-30deg)"; ears = "translateX(90%) rotate(-42deg)"; face = "translateX(" + out + "%) rotate(-42deg)";
        } else {
          el.style.left = "0";
          hidden = "translateX(-140%) rotate(30deg)"; ears = "translateX(-90%) rotate(42deg)"; face = "translateX(-" + out + "%) rotate(42deg)";
        }
        hero.appendChild(el);
      }
      current = el;

      /* 時間割(ms): ポンっと耳が出る → 一度下がる → 顔と胸元まで見えて、2〜3秒こちらを見る → 下がる */
      var hold = rand(2000, 3000);
      var seg = [380, 450, 380, 800, 650, hold, 600];
      var total = seg.reduce(function (sum, v) { return sum + v; }, 0);
      var t = 0;
      function at() { t += seg.shift(); return t / total; }
      var frames = [
        { transform: hidden, offset: 0, easing: "cubic-bezier(.3, 1.6, .5, 1)" },
        { transform: ears, offset: at(), easing: "ease-in-out" },
        { transform: ears, offset: at(), easing: "ease-in" },
        { transform: hidden, offset: at(), easing: "linear" },
        { transform: hidden, offset: at(), easing: "ease-out" },
        { transform: face, offset: at(), easing: "ease-in-out" },
        { transform: face, offset: at(), easing: "ease-in" },
        { transform: hidden, offset: 1 }
      ];
      var anim = el.animate(frames, { duration: total, fill: "both" });
      anim.onfinish = function () {
        if (current === el) current = null;
        el.remove();
        schedule(12000 + Math.random() * 14000);
      };
    }
    /* Heroを離れたらすぐ片づけ、戻ってきたらまた待つ */
    var wasActive = false;
    window.setInterval(function () {
      var now = heroActive();
      if (now && !wasActive) schedule(7000 + Math.random() * 7000);
      if (!now && wasActive) stop();
      wasActive = now;
    }, 400);
  }
  /* ------------------------------------------------------------------
     News: お知らせの吹き出しをクリックで開閉
     ------------------------------------------------------------------ */
  function initNewsToggle() {
    var items = document.querySelectorAll(".news-item");
    var compactQuery = window.matchMedia("(max-width: 1199px)");
    items.forEach(function (item) {
      function toggle() {
        var open = item.classList.toggle("is-open");
        item.setAttribute("aria-expanded", open ? "true" : "false");
        /* スマートフォン・タブレットは、ひとつ開くと、ほかは閉じる（縦幅を節約） */
        if (open && compactQuery.matches) {
          items.forEach(function (other) {
            if (other === item) return;
            other.classList.remove("is-open");
            other.setAttribute("aria-expanded", "false");
          });
        }
      }
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggle(); }
      });
    });
  }

  /* ------------------------------------------------------------------
     Map: クリックで地図を操作でき、枠の外に出ると、ホイールは場面の切り替えに戻る
     ------------------------------------------------------------------ */
  function initMapFrame() {
    var frame = document.getElementById("mapFrame");
    if (!frame) return;
    frame.addEventListener("click", function () { frame.classList.add("is-active"); });
    frame.addEventListener("mouseleave", function () { frame.classList.remove("is-active"); });
    /* タッチ: 地図の外をさわったら、地図の操作を終える（スワイプで場面を切り替えられるように） */
    document.addEventListener("touchstart", function (e) { if (!frame.contains(e.target)) frame.classList.remove("is-active"); }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Menu: ウサギ・タヌキをクリックでメニュー一覧（モーダル）
     ------------------------------------------------------------------ */
  function initMenuModal() {
    var modal = document.getElementById("menuModal");
    if (!modal) return;
    var closeBtn = document.getElementById("menuModalClose");

    function open() { modal.classList.add("is-open"); if (closeBtn) closeBtn.focus(); }
    function close() { modal.classList.remove("is-open"); }

    document.querySelectorAll("[data-menu-open]").forEach(function (el) {
      el.addEventListener("click", open);
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  /* ------------------------------------------------------------------
     News: リスをクリックすると、少しのあいだ吹き出しが出る（タッチ操作向け。ホバーはCSS）
     ------------------------------------------------------------------ */
  function initRisu() {
    var risu = document.getElementById("acornRisu");
    if (!risu) return;
    var timer = null;
    risu.addEventListener("click", function () {
      risu.classList.add("is-talk");
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { risu.classList.remove("is-talk"); }, 3000);
    });
  }
  /* ------------------------------------------------------------------
     Menu（スマートフォン・タブレット）: ウサギの足元に、時々、吹き出しを出す
     ------------------------------------------------------------------ */
  function initMenuRabbitTalk() {
    var rabbit = document.querySelector(".menu-animal--usagi");
    var scene = document.getElementById("menu");
    if (!rabbit || !scene) return;
    var talking = false;
    var last = Date.now();
    window.setInterval(function () {
      var now = Date.now();
      if (!scene.classList.contains("is-ui")) { talking = false; rabbit.classList.remove("is-talk"); last = now; return; }
      var span = talking ? 4500 : 6500;   /* 出ている時間 / 出ていない時間(ms) */
      if (now - last >= span) {
        talking = !talking;
        rabbit.classList.toggle("is-talk", talking);
        last = now;
      }
    }, 300);
  }
  /* ------------------------------------------------------------------
     スマートフォン・タブレット: 縦長の画面(#stage)の中に、ヘッダー・お知らせバッジ・動物の数を入れる。
     タブレットで、左右の余白が十分に広いとき(.has-side)は、ナビゲーションを左の余白、
     お知らせバッジと動物の数を右の余白に、出しっぱなしで置く
     ------------------------------------------------------------------ */
  function initShell() {
    if (!compactMode) return;
    var stage = document.getElementById("stage");
    var header = document.querySelector(".site-header");
    var badge = document.querySelector(".notice-badge");
    var counter = document.getElementById("rabbitCount");
    var siteNav = document.getElementById("siteNav");
    var navList = siteNav && siteNav.querySelector(".nav-list");
    var left = document.getElementById("sideLeft");
    var right = document.getElementById("sideRight");
    var toggle = document.getElementById("navToggle");
    if (!stage || !header || !navList || !left || !right) return;
    stage.insertBefore(header, stage.firstChild);

    function layout() {
      var margin = (window.innerWidth - stage.getBoundingClientRect().width) / 2;
      var side = margin >= 300;
      document.body.classList.toggle("has-side", side);
      if (side) {
        siteNav.classList.remove("is-open");
        if (toggle) toggle.classList.remove("is-open");
        left.appendChild(navList);
        if (badge) right.appendChild(badge);
        if (counter) right.appendChild(counter);
      } else {
        siteNav.appendChild(navList);
        if (badge) stage.appendChild(badge);
        if (counter) stage.appendChild(counter);
      }
    }
    layout();
    window.addEventListener("resize", layout);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLoading();
    initNav();
    initShell();
    if (stageMode) {
      initStage();
    } else {
      initAnchorScroll();
      initReveal();
      initFlowExtras();
    }
    initNewsToggle();
    initMapFrame();
    initMenuModal();
    if (compactMode) initMenuRabbitTalk();
    initRisu();
    initMenuCarousel();
    initHiddenAnimals();
    initHeroWalkers();
  });
})();
