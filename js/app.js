(function () {
  'use strict';

  const STORAGE_KEY = 'bmc_state_v1';
  const Presets = window.BMCPresets;
  const I18n = window.BMCI18n;
  const Calc = window.BMCCalc;

  let nextItemId = 1;

  function makeId() {
    return 'item_' + (nextItemId++) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtNum(val, decimals) {
    const n = Number(val);
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function fmtUsd(val, decimals) {
    const d = decimals !== undefined ? decimals : 0;
    return '$' + fmtNum(val, d);
  }

  function getDefaultSampleItems() {
    return Presets.SAMPLE_PROJECT_ITEMS.map(function (p) {
      return {
        id: makeId(),
        presetId: p.presetId,
        nameEn: p.nameEn,
        nameZh: p.nameZh,
        customName: null,
        unitEn: p.unitEn,
        unitZh: p.unitZh,
        qty: p.qty,
        cbmPerUnit: p.cbmPerUnit,
        kgPerUnit: p.kgPerUnit,
        unitPriceUsd: p.unitPriceUsd,
      };
    });
  }

  function getDefaultState() {
    const route = Presets.FREIGHT_ROUTES[0]; // US West Coast
    const tile = Presets.TILE_PRESETS[1]; // 600x600
    return {
      lang: 'en',
      activeTab: 'container',
      items: getDefaultSampleItems(),
      weightProfile: route.recommendedWeightProfile || 'standard',
      routeId: route.id,
      rates: {
        lclPerCbm: route.lclPerCbm,
        rate20GP: route.rate20GP,
        rate40GP: route.rate40GP,
        rate40HQ: route.rate40HQ,
        localFees: route.localFees,
      },
      tile: {
        unitSystem: 'metric',
        netArea: 120,
        presetId: tile.id,
        tileLength: tile.lengthMm,
        tileWidth: tile.widthMm,
        pcsPerCarton: tile.pcsPerCarton,
        patternId: 'offset',
        wastagePct: 10,
        unitPrice: tile.defaultPriceM2,
        kgPerM2: tile.kgPerM2,
        cbmPerM2: tile.cbmPerM2,
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultState();
      const parsed = JSON.parse(raw);
      const def = getDefaultState();
      return {
        lang: parsed.lang === 'zh' ? 'zh' : 'en',
        activeTab: parsed.activeTab === 'tile' ? 'tile' : 'container',
        items: Array.isArray(parsed.items) ? parsed.items : def.items,
        weightProfile: parsed.weightProfile || def.weightProfile,
        routeId: parsed.routeId || def.routeId,
        rates: Object.assign({}, def.rates, parsed.rates || {}),
        tile: Object.assign({}, def.tile, parsed.tile || {}),
      };
    } catch (e) {
      return getDefaultState();
    }
  }

  let state = loadState();
  let toastTimer = null;

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage quota / private mode errors
    }
  }

  function t(key, params) {
    return I18n.t(state.lang, key, params);
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, 2600);
  }

  function getItemDisplayName(item) {
    if (item.customName !== null && item.customName !== undefined) {
      return item.customName;
    }
    return state.lang === 'zh' ? (item.nameZh || item.nameEn) : (item.nameEn || item.nameZh);
  }

  function getItemUnit(item) {
    return state.lang === 'zh' ? (item.unitZh || item.unitEn) : (item.unitEn || item.unitZh);
  }

  /* ===================== STATIC I18N & SELECTS ===================== */

  function applyStaticI18n() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    const nodes = document.querySelectorAll('[data-i18n]');
    nodes.forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === state.lang);
    });

    populatePresetSelects();
  }

  function populatePresetSelects() {
    // Material preset selector
    const matSel = document.getElementById('presetMaterialSelect');
    const prevMat = matSel.value;
    matSel.innerHTML = Presets.MATERIAL_PRESETS.map(function (p) {
      const label = state.lang === 'zh' ? p.nameZh : p.nameEn;
      const unit = state.lang === 'zh' ? p.unitZh : p.unitEn;
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(label) + ' (' + escapeHtml(unit) + ')</option>';
    }).join('');
    if (prevMat) matSel.value = prevMat;

    // Weight profile selector
    const wtSel = document.getElementById('weightProfileSelect');
    wtSel.innerHTML = Object.keys(Presets.WEIGHT_PROFILES).map(function (k) {
      const p = Presets.WEIGHT_PROFILES[k];
      const label = state.lang === 'zh' ? p.labelZh : p.labelEn;
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    wtSel.value = state.weightProfile;

    // Route preset selector
    const routeSel = document.getElementById('routePresetSelect');
    routeSel.innerHTML = Presets.FREIGHT_ROUTES.map(function (r) {
      const label = state.lang === 'zh' ? r.nameZh : r.nameEn;
      return '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    routeSel.value = state.routeId;

    // Tile format preset selector
    const tileSel = document.getElementById('tilePresetSelect');
    tileSel.innerHTML = Presets.TILE_PRESETS.map(function (p) {
      const label = state.lang === 'zh' ? p.labelZh : p.labelEn;
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(label) + '</option>';
    }).join('');
    tileSel.value = state.tile.presetId;

    // Laying pattern selector
    const patSel = document.getElementById('layingPatternSelect');
    patSel.innerHTML = Presets.LAYING_PATTERNS.map(function (p) {
      const label = state.lang === 'zh' ? p.labelZh : p.labelEn;
      const suffix = p.id === 'custom' ? '' : ' (' + p.wastePct + '%)';
      return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(label + suffix) + '</option>';
    }).join('');
    patSel.value = state.tile.patternId;

    updateLayingPatternDesc();
  }

  function updateLayingPatternDesc() {
    const pat = Presets.LAYING_PATTERNS.find(function (p) {
      return p.id === state.tile.patternId;
    });
    const el = document.getElementById('layingPatternDesc');
    if (el && pat) {
      el.textContent = state.lang === 'zh' ? pat.descZh : pat.descEn;
    }
  }

  /* ===================== TABS ===================== */

  function renderTabs() {
    const isContainer = state.activeTab === 'container';
    document.getElementById('tabBtnContainer').classList.toggle('active', isContainer);
    document.getElementById('tabBtnContainer').setAttribute('aria-selected', String(isContainer));
    document.getElementById('tabBtnTile').classList.toggle('active', !isContainer);
    document.getElementById('tabBtnTile').setAttribute('aria-selected', String(!isContainer));

    document.getElementById('panelContainer').classList.toggle('hidden', !isContainer);
    document.getElementById('panelTile').classList.toggle('hidden', isContainer);
  }

  /* ===================== MODULE 1: CONTAINER ===================== */

  function syncFreightInputs() {
    document.getElementById('rateLclInput').value = state.rates.lclPerCbm;
    document.getElementById('rate20GPInput').value = state.rates.rate20GP;
    document.getElementById('rate40GPInput').value = state.rates.rate40GP;
    document.getElementById('rate40HQInput').value = state.rates.rate40HQ;
    document.getElementById('rateLocalFeesInput').value = state.rates.localFees;
  }

  function renderCargoList() {
    const wrap = document.getElementById('cargoListContainer');
    const badge = document.getElementById('cargoCountBadge');
    badge.textContent = String(state.items.length);

    if (state.items.length === 0) {
      wrap.innerHTML = '<div class="empty-state">' + escapeHtml(t('emptyCargoHint')) + '</div>';
      return;
    }

    wrap.innerHTML = state.items.map(function (item) {
      const name = getItemDisplayName(item);
      const unit = getItemUnit(item);
      const lineCbm = (Number(item.qty) || 0) * (Number(item.cbmPerUnit) || 0);
      const lineKg = (Number(item.qty) || 0) * (Number(item.kgPerUnit) || 0);
      const lineVal = (Number(item.qty) || 0) * (Number(item.unitPriceUsd) || 0);

      return (
        '<div class="cargo-item" data-item-id="' + escapeHtml(item.id) + '">' +
          '<div class="cargo-item-top">' +
            '<input type="text" class="input input-compact cargo-name-input" data-field="name" value="' + escapeHtml(name) + '" aria-label="' + escapeHtml(t('colMaterial')) + '" />' +
            '<span class="cargo-unit-pill">' + escapeHtml(unit) + '</span>' +
            '<button type="button" class="btn-icon-danger" data-action="remove" title="' + escapeHtml(t('removeItem')) + '" aria-label="' + escapeHtml(t('removeItem')) + '">&times;</button>' +
          '</div>' +
          '<div class="cargo-item-fields">' +
            '<div class="field">' +
              '<label>' + escapeHtml(t('colQty')) + ' (' + escapeHtml(unit) + ')</label>' +
              '<input type="number" class="input input-compact tabular" data-field="qty" min="0" step="any" value="' + escapeHtml(item.qty) + '" />' +
            '</div>' +
            '<div class="field">' +
              '<label>' + escapeHtml(t('colCbmUnit')) + '</label>' +
              '<input type="number" class="input input-compact tabular" data-field="cbmPerUnit" min="0" step="0.0005" value="' + escapeHtml(item.cbmPerUnit) + '" />' +
            '</div>' +
            '<div class="field">' +
              '<label>' + escapeHtml(t('colKgUnit')) + '</label>' +
              '<input type="number" class="input input-compact tabular" data-field="kgPerUnit" min="0" step="0.5" value="' + escapeHtml(item.kgPerUnit) + '" />' +
            '</div>' +
            '<div class="field">' +
              '<label>' + escapeHtml(t('colPriceUnit')) + '</label>' +
              '<input type="number" class="input input-compact tabular" data-field="unitPriceUsd" min="0" step="0.5" value="' + escapeHtml(item.unitPriceUsd) + '" />' +
            '</div>' +
          '</div>' +
          '<div class="cargo-item-footer">' +
            '<span>' + escapeHtml(t('colSubtotals')) + '</span>' +
            '<div class="cargo-subtotals">' +
              '<span data-sub="cbm">' + fmtNum(lineCbm, 2) + ' CBM</span>' +
              '<span data-sub="wt">' + fmtNum(lineKg / 1000, 2) + ' t</span>' +
              '<span data-sub="val">' + fmtUsd(lineVal, 0) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function updateSingleItemSubtotals(itemEl, item) {
    const lineCbm = (Number(item.qty) || 0) * (Number(item.cbmPerUnit) || 0);
    const lineKg = (Number(item.qty) || 0) * (Number(item.kgPerUnit) || 0);
    const lineVal = (Number(item.qty) || 0) * (Number(item.unitPriceUsd) || 0);

    const cbmEl = itemEl.querySelector('[data-sub="cbm"]');
    const wtEl = itemEl.querySelector('[data-sub="wt"]');
    const valEl = itemEl.querySelector('[data-sub="val"]');
    if (cbmEl) cbmEl.textContent = fmtNum(lineCbm, 2) + ' CBM';
    if (wtEl) wtEl.textContent = fmtNum(lineKg / 1000, 2) + ' t';
    if (valEl) valEl.textContent = fmtUsd(lineVal, 0);
  }

  function getBarClass(pct) {
    if (pct > 95) return 'critical';
    if (pct > 85) return 'high';
    if (pct >= 65) return 'optimal';
    return '';
  }

  function renderContainerResults() {
    const body = document.getElementById('containerResultsBody');
    const constraintSlot = document.getElementById('constraintBadgeSlot');

    const res = Calc.calculateContainerPlan({
      items: state.items,
      containers: Presets.CONTAINERS,
      weightProfile: state.weightProfile,
      rates: state.rates,
    });

    if (!res.hasCargo) {
      constraintSlot.innerHTML = '';
      body.innerHTML = '<div class="empty-state">' + escapeHtml(t('noCargoYet')) + '</div>';
      return;
    }

    // Constraint badge
    const constraintText =
      res.bindingConstraint === 'weight'
        ? t('constraintWeight')
        : res.bindingConstraint === 'volume'
        ? t('constraintVolume')
        : t('constraintBalanced');
    constraintSlot.innerHTML =
      '<span class="constraint-pill ' + res.bindingConstraint + '">' + escapeHtml(constraintText) + '</span>';

    // Freight ratio status
    let ratioClass = 'status-healthy';
    let ratioLabel = t('ratioHealthy');
    if (res.totalFobUsd <= 0) {
      ratioClass = '';
      ratioLabel = '—';
    } else if (res.freightRatioPct > 22) {
      ratioClass = 'status-high';
      ratioLabel = t('ratioHigh');
    } else if (res.freightRatioPct >= 12) {
      ratioClass = 'status-moderate';
      ratioLabel = t('ratioModerate');
    }

    const rec = res.recommended;
    const planNote = rec.mode === 'LCL' ? t('planLclNote') : t('planFclNote');

    // Utilization HTML (only for FCL)
    let utilHtml = '';
    let insightHtml = '';
    if (rec.mode === 'FCL') {
      const volPct = Math.min(100, rec.volUtilPct);
      const wtPct = Math.min(100, rec.wtUtilPct);

      utilHtml =
        '<div class="util-section">' +
          '<div>' +
            '<div class="util-row-head">' +
              '<span>' + escapeHtml(t('volUtilLabel')) + '</span>' +
              '<strong class="tabular">' + fmtNum(rec.volUtilPct, 1) + '% (' + fmtNum(res.totalCbm, 2) + ' / ' + fmtNum(rec.capCbm, 0) + ' CBM)</strong>' +
            '</div>' +
            '<div class="util-bar-track"><div class="util-bar-fill ' + getBarClass(rec.volUtilPct) + '" style="width:' + volPct.toFixed(1) + '%"></div></div>' +
          '</div>' +
          '<div>' +
            '<div class="util-row-head">' +
              '<span>' + escapeHtml(t('wtUtilLabel')) + '</span>' +
              '<strong class="tabular">' + fmtNum(rec.wtUtilPct, 1) + '% (' + fmtNum(res.totalWeightMt, 2) + ' / ' + fmtNum(rec.capWtKg / 1000, 1) + ' t)</strong>' +
            '</div>' +
            '<div class="util-bar-track"><div class="util-bar-fill ' + getBarClass(rec.wtUtilPct) + '" style="width:' + wtPct.toFixed(1) + '%"></div></div>' +
          '</div>' +
        '</div>';

      let insightMsg = t('freeSpaceBalancedMsg');
      if (res.bindingConstraint === 'weight') {
        insightMsg = t('freeSpaceWeightMsg', { cbm: fmtNum(rec.remainingCbm, 1) });
      } else if (res.bindingConstraint === 'volume') {
        insightMsg = t('freeSpaceVolumeMsg', { tons: fmtNum(rec.remainingWeightKg / 1000, 1) });
      }

      insightHtml =
        '<div class="insight-box">' +
          '<strong>' + escapeHtml(t('freeSpaceTip')) + '</strong>' +
          escapeHtml(insightMsg) +
        '</div>';
    }

    // Comparison rows
    const compRows = res.comparisonList.map(function (opt) {
      const isBest = opt.label === rec.label;
      const volStr = opt.volUtilPct !== null ? fmtNum(opt.volUtilPct, 0) + '%' : '—';
      const wtStr = opt.wtUtilPct !== null ? fmtNum(opt.wtUtilPct, 0) + '%' : '—';
      const unitBasis = opt.mode === 'LCL'
        ? fmtNum(opt.chargeableRT, 2) + ' W/M'
        : opt.containerCount + (opt.containerCount === 1 ? ' box' : ' boxes');

      return (
        '<tr class="' + (isBest ? 'best-row' : '') + '">' +
          '<td>' + escapeHtml(opt.label) + (isBest ? '<span class="best-tag">' + escapeHtml(t('tagBest')) + '</span>' : '') + '</td>' +
          '<td>' + escapeHtml(unitBasis) + '</td>' +
          '<td>' + volStr + '</td>' +
          '<td>' + wtStr + '</td>' +
          '<td><strong>' + fmtUsd(opt.totalShipping, 0) + '</strong></td>' +
        '</tr>'
      );
    }).join('');

    body.innerHTML =
      '<div class="kpi-grid">' +
        '<div class="kpi-box">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiTotalCbm')) + '</div>' +
          '<div class="kpi-value tabular">' + fmtNum(res.totalCbm, 2) + ' CBM</div>' +
          '<div class="kpi-sub tabular">' + fmtNum(res.totalCbm * 35.3147, 0) + ' cu ft</div>' +
        '</div>' +
        '<div class="kpi-box">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiTotalWeight')) + '</div>' +
          '<div class="kpi-value tabular">' + fmtNum(res.totalWeightMt, 2) + ' MT</div>' +
          '<div class="kpi-sub tabular">' + fmtNum(res.totalWeightKg, 0) + ' kg</div>' +
        '</div>' +
        '<div class="kpi-box">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiCargoValue')) + '</div>' +
          '<div class="kpi-value tabular">' + fmtUsd(res.totalFobUsd, 0) + '</div>' +
          '<div class="kpi-sub tabular">' + escapeHtml(t('rowFreightPerCbm')) + ': ' + fmtUsd(res.freightPerCbm, 0) + '</div>' +
        '</div>' +
        '<div class="kpi-box accent">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiFreightRatio')) + '</div>' +
          '<div class="kpi-value tabular ' + ratioClass + '">' + (res.totalFobUsd > 0 ? fmtNum(res.freightRatioPct, 1) + '%' : '—') + '</div>' +
          '<div class="kpi-sub ' + ratioClass + '">' + escapeHtml(ratioLabel) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="plan-banner">' +
        '<div class="plan-banner-head">' +
          '<span class="plan-banner-label">' + escapeHtml(t('recommendedPlan')) + '</span>' +
          '<strong class="tabular">' + fmtUsd(rec.totalShipping, 0) + '</strong>' +
        '</div>' +
        '<div class="plan-banner-value tabular">' + escapeHtml(rec.label) + '</div>' +
        '<div class="plan-banner-note">' + escapeHtml(planNote) + '</div>' +
      '</div>' +

      utilHtml +
      insightHtml +

      '<div class="section-subhead">' + escapeHtml(t('costBreakdownTitle')) + '</div>' +
      '<table class="kv-table">' +
        '<tr><td>' + escapeHtml(t('rowFobValue')) + '</td><td>' + fmtUsd(res.totalFobUsd, 0) + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowOceanFreight')) + '</td><td>' + fmtUsd(rec.oceanFreight, 0) + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowFixedFees')) + '</td><td>' + fmtUsd(res.fixedFeesUsd, 0) + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowTotalShipping')) + '</td><td>' + fmtUsd(rec.totalShipping, 0) + '</td></tr>' +
        '<tr class="total-row"><td>' + escapeHtml(t('rowEstLanded')) + '</td><td>' + fmtUsd(res.estLandedUsd, 0) + '</td></tr>' +
      '</table>' +

      '<div class="section-subhead">' + escapeHtml(t('compareOptionsTitle')) + '</div>' +
      '<div class="comp-table-wrap">' +
        '<table class="comp-table">' +
          '<thead><tr>' +
            '<th>' + escapeHtml(t('colOption')) + '</th>' +
            '<th>' + escapeHtml(t('colUnits')) + '</th>' +
            '<th>' + escapeHtml(t('colVolUtil')) + '</th>' +
            '<th>' + escapeHtml(t('colWtUtil')) + '</th>' +
            '<th>' + escapeHtml(t('colEstFreight')) + '</th>' +
          '</tr></thead>' +
          '<tbody>' + compRows + '</tbody>' +
        '</table>' +
      '</div>';
  }

  /* ===================== MODULE 2: TILE & STONE ===================== */

  function syncTileInputs() {
    const u = state.tile.unitSystem;
    const isImp = u === 'imperial';

    document.getElementById('unitMetricBtn').classList.toggle('active', !isImp);
    document.getElementById('unitImperialBtn').classList.toggle('active', isImp);

    document.getElementById('tileAreaUnitLabel').textContent = isImp ? 'sq ft' : 'm²';
    document.getElementById('tilePriceUnitLabel').textContent = isImp ? 'sq ft' : 'm²';
    document.querySelectorAll('.room-dim-unit').forEach(function (el) {
      el.textContent = isImp ? 'ft' : 'm';
    });
    document.querySelectorAll('.tile-dim-unit').forEach(function (el) {
      el.textContent = isImp ? 'in' : 'mm';
    });

    document.getElementById('tileNetAreaInput').value = state.tile.netArea;
    document.getElementById('tilePresetSelect').value = state.tile.presetId;
    document.getElementById('tileLengthInput').value = state.tile.tileLength;
    document.getElementById('tileWidthInput').value = state.tile.tileWidth;
    document.getElementById('tilePcsCartonInput').value = state.tile.pcsPerCarton;
    document.getElementById('layingPatternSelect').value = state.tile.patternId;
    document.getElementById('tileWastageInput').value = state.tile.wastagePct;
    document.getElementById('tileUnitPriceInput').value = state.tile.unitPrice;
    document.getElementById('tileKgPerM2Input').value = state.tile.kgPerM2;
    document.getElementById('tileCbmPerM2Input').value = state.tile.cbmPerM2;

    updateLayingPatternDesc();
  }

  function renderTileResults() {
    const body = document.getElementById('tileResultsBody');
    const badge = document.getElementById('tileFormatBadge');

    const res = Calc.calculateTileEstimate(state.tile);

    const dimUnit = state.tile.unitSystem === 'imperial' ? '"' : ' mm';
    badge.textContent = state.tile.tileLength + ' × ' + state.tile.tileWidth + dimUnit;

    if (!res.valid) {
      body.innerHTML = '<div class="empty-state">' + escapeHtml(t('noCargoYet')) + '</div>';
      return;
    }

    const areaUnit = res.areaUnitLabel;
    const packUnit = res.isSlab ? t('unitSlabs') : t('unitCartons');
    const orderDisplay = res.isSlab
      ? fmtNum(res.cartonsToOrder, 0) + ' ' + packUnit
      : fmtNum(res.cartonsToOrder, 0) + ' ' + packUnit + ' (' + fmtNum(res.orderPieces, 0) + ' ' + t('unitPcs') + ')';

    body.innerHTML =
      '<div class="kpi-grid">' +
        '<div class="kpi-box">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiPurchaseArea')) + '</div>' +
          '<div class="kpi-value tabular">' + fmtNum(res.actualPurchasedAreaDisplay, 1) + ' ' + areaUnit + '</div>' +
          '<div class="kpi-sub tabular">+' + fmtNum(res.wastagePct, 0) + '% ' + escapeHtml(t('rowWastage')) + '</div>' +
        '</div>' +
        '<div class="kpi-box accent">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiOrderQty')) + '</div>' +
          '<div class="kpi-value tabular">' + fmtNum(res.cartonsToOrder, 0) + ' ' + escapeHtml(packUnit) + '</div>' +
          '<div class="kpi-sub tabular">' + fmtNum(res.orderPieces, 0) + ' ' + escapeHtml(t('unitPcs')) + '</div>' +
        '</div>' +
        '<div class="kpi-box">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiEstBudget')) + '</div>' +
          '<div class="kpi-value tabular">' + fmtUsd(res.estBudgetUsd, 0) + '</div>' +
          '<div class="kpi-sub tabular">' + fmtUsd(res.pricePerM2Usd, 2) + ' / m²</div>' +
        '</div>' +
        '<div class="kpi-box">' +
          '<div class="kpi-label">' + escapeHtml(t('kpiEstLoad')) + '</div>' +
          '<div class="kpi-value tabular">' + fmtNum(res.estCbm, 2) + ' CBM</div>' +
          '<div class="kpi-sub tabular">' + fmtNum(res.estWeightKg / 1000, 2) + ' MT (' + fmtNum(res.estWeightKg, 0) + ' kg)</div>' +
        '</div>' +
      '</div>' +

      '<table class="kv-table">' +
        '<tr><td>' + escapeHtml(t('rowNetArea')) + '</td><td>' + fmtNum(res.netAreaDisplay, 2) + ' ' + areaUnit + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowWastage')) + ' (' + fmtNum(res.wastagePct, 1) + '%)</td><td>+' + fmtNum(res.wastageAreaDisplay, 2) + ' ' + areaUnit + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowRequiredArea')) + '</td><td>' + fmtNum(res.requiredAreaDisplay, 2) + ' ' + areaUnit + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowExactPieces')) + '</td><td>' + fmtNum(res.exactPieces, 0) + ' ' + escapeHtml(t('unitPcs')) + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowCartonCoverage')) + '</td><td>' + fmtNum(res.cartonCoverageDisplay, 2) + ' ' + areaUnit + '</td></tr>' +
        '<tr class="total-row"><td>' + escapeHtml(t('rowRoundedOrder')) + '</td><td>' + escapeHtml(orderDisplay) + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowActualArea')) + '</td><td>' + fmtNum(res.actualPurchasedAreaDisplay, 2) + ' ' + areaUnit + (res.unitSystem === 'imperial' ? ' (' + fmtNum(res.actualPurchasedAreaM2, 1) + ' m²)' : '') + '</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowEstWeight')) + '</td><td>' + fmtNum(res.estWeightKg, 0) + ' kg (' + fmtNum(res.estWeightKg / 1000, 2) + ' MT)</td></tr>' +
        '<tr><td>' + escapeHtml(t('rowEstCbm')) + '</td><td>' + fmtNum(res.estCbm, 2) + ' CBM</td></tr>' +
      '</table>' +

      '<div class="disclaimer-box">' + escapeHtml(t('tileNoteFullCarton')) + '</div>' +

      '<button type="button" class="btn btn-primary cta-bridge no-print" id="btnPushTileToContainer">' +
        escapeHtml(t('btnSendToContainer')) +
      '</button>';

    document.getElementById('btnPushTileToContainer').addEventListener('click', function () {
      pushTileEstimateToContainer(res);
    });
  }

  function pushTileEstimateToContainer(res) {
    const preset = Presets.TILE_PRESETS.find(function (p) {
      return p.id === state.tile.presetId;
    });
    const sizeLabel = Math.round(res.lengthMm) + '×' + Math.round(res.widthMm) + 'mm';
    const isStone = preset && preset.category === 'stone';
    const nameEn = (isStone ? 'Stone / Slab (' : 'Porcelain Tile (') + sizeLabel + ', ' + res.cartonsToOrder + (res.isSlab ? ' slabs)' : ' cartons)');
    const nameZh = (isStone ? '石材/岩板 (' : '瓷砖 (') + sizeLabel + ', ' + res.cartonsToOrder + (res.isSlab ? '张)' : '箱)');

    state.items.push({
      id: makeId(),
      presetId: isStone ? 'stone_slab_20mm' : 'porcelain_tile_600',
      nameEn: nameEn,
      nameZh: nameZh,
      customName: null,
      unitEn: 'm²',
      unitZh: 'm²',
      qty: Calc.round2(res.actualPurchasedAreaM2),
      cbmPerUnit: Calc.round3(res.cbmPerM2),
      kgPerUnit: Calc.round2(res.kgPerM2),
      unitPriceUsd: Calc.round2(res.pricePerM2Usd),
    });

    state.activeTab = 'container';
    saveState();
    renderTabs();
    renderCargoList();
    renderContainerResults();
    showToast(t('sentToast', { name: state.lang === 'zh' ? nameZh : nameEn }));
  }

  /* ===================== PLAIN TEXT SUMMARY & PRINT ===================== */

  function buildPlainTextSummary() {
    const isZh = state.lang === 'zh';
    if (state.activeTab === 'container') {
      const res = Calc.calculateContainerPlan({
        items: state.items,
        containers: Presets.CONTAINERS,
        weightProfile: state.weightProfile,
        rates: state.rates,
      });
      if (!res.hasCargo) return '';
      const lines = [];
      lines.push(isZh ? '=== 建材装柜与运费估算摘要 ===' : '=== Building Materials Container & Freight Estimate ===');
      state.items.forEach(function (item, idx) {
        const s = res.lineSummaries[idx];
        lines.push(
          '- ' + getItemDisplayName(item) + ': ' +
          item.qty + ' ' + getItemUnit(item) +
          ' | ' + fmtNum(s.lineCbm, 2) + ' CBM | ' +
          fmtNum(s.lineWeightKg / 1000, 2) + ' MT | ' +
          fmtUsd(s.lineValueUsd, 0)
        );
      });
      lines.push('---');
      lines.push((isZh ? '总体积: ' : 'Total Volume: ') + fmtNum(res.totalCbm, 2) + ' CBM');
      lines.push((isZh ? '总毛重: ' : 'Total Gross Weight: ') + fmtNum(res.totalWeightMt, 2) + ' MT (' + fmtNum(res.totalWeightKg, 0) + ' kg)');
      lines.push((isZh ? '货值 (FOB): ' : 'Cargo Value (FOB): ') + fmtUsd(res.totalFobUsd, 0));
      lines.push((isZh ? '推荐方案: ' : 'Recommended Plan: ') + res.recommended.label);
      if (res.recommended.mode === 'FCL') {
        lines.push(
          (isZh ? '利用率: 体积 ' : 'Utilization: Vol ') +
          fmtNum(res.recommended.volUtilPct, 1) + '% / ' +
          (isZh ? '载重 ' : 'Wt ') + fmtNum(res.recommended.wtUtilPct, 1) + '%'
        );
      }
      lines.push((isZh ? '预估总运费: ' : 'Est. Total Shipping: ') + fmtUsd(res.recommended.totalShipping, 0));
      if (res.totalFobUsd > 0) {
        lines.push((isZh ? '运费占比: ' : 'Freight-to-Cargo Ratio: ') + fmtNum(res.freightRatioPct, 1) + '%');
      }
      lines.push((isZh ? '货值+物流小计: ' : 'Est. Cargo + Shipping: ') + fmtUsd(res.estLandedUsd, 0));
      return lines.join('\n');
    } else {
      const res = Calc.calculateTileEstimate(state.tile);
      if (!res.valid) return '';
      const areaUnit = res.areaUnitLabel;
      const packUnit = res.isSlab ? t('unitSlabs') : t('unitCartons');
      const lines = [];
      lines.push(isZh ? '=== 瓷砖/石材损耗与预算估算 ===' : '=== Tile & Stone Wastage & Budget Estimate ===');
      lines.push((isZh ? '规格: ' : 'Format: ') + Math.round(res.lengthMm) + ' × ' + Math.round(res.widthMm) + ' mm');
      lines.push((isZh ? '铺贴净面积: ' : 'Net Area: ') + fmtNum(res.netAreaDisplay, 2) + ' ' + areaUnit);
      lines.push((isZh ? '损耗预留: ' : 'Wastage Allowance: ') + fmtNum(res.wastagePct, 1) + '%');
      lines.push((isZh ? '建议采购量: ' : 'Full-Carton Order: ') + fmtNum(res.cartonsToOrder, 0) + ' ' + packUnit + ' (' + fmtNum(res.orderPieces, 0) + ' ' + t('unitPcs') + ')');
      lines.push((isZh ? '实际采购面积: ' : 'Actual Purchased Area: ') + fmtNum(res.actualPurchasedAreaDisplay, 2) + ' ' + areaUnit);
      lines.push((isZh ? '预估材料预算: ' : 'Est. Material Budget: ') + fmtUsd(res.estBudgetUsd, 0));
      lines.push((isZh ? '预估出口货量: ' : 'Est. Export Load: ') + fmtNum(res.estCbm, 2) + ' CBM / ' + fmtNum(res.estWeightKg / 1000, 2) + ' MT');
      return lines.join('\n');
    }
  }

  function copySummary() {
    const text = buildPlainTextSummary();
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(t('btnCopied'));
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(t('btnCopied'));
    } catch (e) {
      // Ignore
    }
    document.body.removeChild(ta);
  }

  /* ===================== EVENT BINDINGS ===================== */

  function bindEvents() {
    // Language switcher
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const lang = btn.getAttribute('data-lang');
        if (lang !== state.lang) {
          state.lang = lang;
          saveState();
          applyStaticI18n();
          renderCargoList();
          renderContainerResults();
          renderTileResults();
        }
      });
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeTab = btn.getAttribute('data-tab');
        saveState();
        renderTabs();
      });
    });

    // Header actions
    document.getElementById('btnLoadSample').addEventListener('click', function () {
      const def = getDefaultState();
      state.items = def.items;
      state.weightProfile = def.weightProfile;
      state.routeId = def.routeId;
      state.rates = def.rates;
      state.activeTab = 'container';
      saveState();
      applyStaticI18n();
      syncFreightInputs();
      renderTabs();
      renderCargoList();
      renderContainerResults();
      showToast(t('btnSample'));
    });

    document.getElementById('btnResetAll').addEventListener('click', function () {
      if (state.activeTab === 'container') {
        state.items = [];
        saveState();
        renderCargoList();
        renderContainerResults();
      } else {
        const def = getDefaultState();
        state.tile = def.tile;
        saveState();
        syncTileInputs();
        renderTileResults();
      }
    });

    document.getElementById('btnCopySummary').addEventListener('click', copySummary);

    document.getElementById('btnPrint').addEventListener('click', function () {
      document.getElementById('printTitle').textContent = t('appTitle');
      document.getElementById('printMeta').textContent =
        t('printMeta') + ' — ' + new Date().toISOString().slice(0, 10);
      window.print();
    });

    // Add cargo item from preset
    document.getElementById('btnAddCargoItem').addEventListener('click', function () {
      const presetId = document.getElementById('presetMaterialSelect').value;
      const p = Presets.MATERIAL_PRESETS.find(function (x) {
        return x.id === presetId;
      }) || Presets.MATERIAL_PRESETS[0];

      state.items.push({
        id: makeId(),
        presetId: p.id,
        nameEn: p.nameEn,
        nameZh: p.nameZh,
        customName: null,
        unitEn: p.unitEn,
        unitZh: p.unitZh,
        qty: p.defaultQty,
        cbmPerUnit: p.cbmPerUnit,
        kgPerUnit: p.kgPerUnit,
        unitPriceUsd: p.defaultPriceUsd,
      });
      saveState();
      renderCargoList();
      renderContainerResults();
    });

    // Delegated cargo list input/delete (preserves input focus while editing!)
    const cargoContainer = document.getElementById('cargoListContainer');
    cargoContainer.addEventListener('input', function (e) {
      const input = e.target;
      const itemEl = input.closest('.cargo-item');
      if (!itemEl) return;
      const id = itemEl.getAttribute('data-item-id');
      const field = input.getAttribute('data-field');
      const item = state.items.find(function (x) {
        return x.id === id;
      });
      if (!item || !field) return;

      if (field === 'name') {
        item.customName = input.value;
      } else {
        const num = parseFloat(input.value);
        item[field] = Number.isFinite(num) && num >= 0 ? num : 0;
      }
      saveState();
      updateSingleItemSubtotals(itemEl, item);
      renderContainerResults();
    });

    cargoContainer.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action="remove"]');
      if (!btn) return;
      const itemEl = btn.closest('.cargo-item');
      if (!itemEl) return;
      const id = itemEl.getAttribute('data-item-id');
      state.items = state.items.filter(function (x) {
        return x.id !== id;
      });
      saveState();
      renderCargoList();
      renderContainerResults();
    });

    // Weight profile & route preset
    document.getElementById('weightProfileSelect').addEventListener('change', function (e) {
      state.weightProfile = e.target.value;
      saveState();
      renderContainerResults();
    });

    document.getElementById('routePresetSelect').addEventListener('change', function (e) {
      const routeId = e.target.value;
      state.routeId = routeId;
      const route = Presets.FREIGHT_ROUTES.find(function (r) {
        return r.id === routeId;
      });
      if (route && route.id !== 'custom') {
        state.rates.lclPerCbm = route.lclPerCbm;
        state.rates.rate20GP = route.rate20GP;
        state.rates.rate40GP = route.rate40GP;
        state.rates.rate40HQ = route.rate40HQ;
        state.rates.localFees = route.localFees;
        if (route.recommendedWeightProfile) {
          state.weightProfile = route.recommendedWeightProfile;
          document.getElementById('weightProfileSelect').value = state.weightProfile;
        }
        syncFreightInputs();
      }
      saveState();
      renderContainerResults();
    });

    // Freight rate inputs
    [
      ['rateLclInput', 'lclPerCbm'],
      ['rate20GPInput', 'rate20GP'],
      ['rate40GPInput', 'rate40GP'],
      ['rate40HQInput', 'rate40HQ'],
      ['rateLocalFeesInput', 'localFees'],
    ].forEach(function (pair) {
      document.getElementById(pair[0]).addEventListener('input', function (e) {
        const val = parseFloat(e.target.value);
        state.rates[pair[1]] = Number.isFinite(val) && val >= 0 ? val : 0;
        state.routeId = 'custom';
        document.getElementById('routePresetSelect').value = 'custom';
        saveState();
        renderContainerResults();
      });
    });

    // Module 2: Unit System toggle with lossless conversion
    document.querySelectorAll('#unitMetricBtn, #unitImperialBtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.getAttribute('data-unit');
        if (target === state.tile.unitSystem) return;
        const toImperial = target === 'imperial';
        if (toImperial) {
          state.tile.netArea = Calc.round2(state.tile.netArea * Calc.SQFT_PER_M2);
          state.tile.tileLength = Calc.round2(state.tile.tileLength / Calc.MM_PER_INCH);
          state.tile.tileWidth = Calc.round2(state.tile.tileWidth / Calc.MM_PER_INCH);
          state.tile.unitPrice = Calc.round2(state.tile.unitPrice / Calc.SQFT_PER_M2);
        } else {
          state.tile.netArea = Calc.round2(state.tile.netArea / Calc.SQFT_PER_M2);
          state.tile.tileLength = Math.round(state.tile.tileLength * Calc.MM_PER_INCH);
          state.tile.tileWidth = Math.round(state.tile.tileWidth * Calc.MM_PER_INCH);
          state.tile.unitPrice = Calc.round2(state.tile.unitPrice * Calc.SQFT_PER_M2);
        }
        state.tile.unitSystem = target;
        saveState();
        syncTileInputs();
        renderTileResults();
      });
    });

    // Module 2: Room L x W helper
    document.getElementById('btnApplyRoomDim').addEventListener('click', function () {
      const l = parseFloat(document.getElementById('roomLengthInput').value);
      const w = parseFloat(document.getElementById('roomWidthInput').value);
      if (Number.isFinite(l) && Number.isFinite(w) && l > 0 && w > 0) {
        state.tile.netArea = Calc.round2(l * w);
        document.getElementById('tileNetAreaInput').value = state.tile.netArea;
        saveState();
        renderTileResults();
      }
    });

    // Module 2: Tile format preset
    document.getElementById('tilePresetSelect').addEventListener('change', function (e) {
      const id = e.target.value;
      state.tile.presetId = id;
      const preset = Presets.TILE_PRESETS.find(function (p) {
        return p.id === id;
      });
      if (preset && preset.id !== 'custom') {
        const isImp = state.tile.unitSystem === 'imperial';
        state.tile.tileLength = isImp ? Calc.round2(preset.lengthMm / Calc.MM_PER_INCH) : preset.lengthMm;
        state.tile.tileWidth = isImp ? Calc.round2(preset.widthMm / Calc.MM_PER_INCH) : preset.widthMm;
        state.tile.pcsPerCarton = preset.pcsPerCarton;
        state.tile.kgPerM2 = preset.kgPerM2;
        state.tile.cbmPerM2 = preset.cbmPerM2;
        state.tile.unitPrice = isImp
          ? Calc.round2(preset.defaultPriceM2 / Calc.SQFT_PER_M2)
          : preset.defaultPriceM2;
        syncTileInputs();
      }
      saveState();
      renderTileResults();
    });

    // Module 2: Laying pattern
    document.getElementById('layingPatternSelect').addEventListener('change', function (e) {
      const id = e.target.value;
      state.tile.patternId = id;
      const pat = Presets.LAYING_PATTERNS.find(function (p) {
        return p.id === id;
      });
      if (pat && pat.id !== 'custom') {
        state.tile.wastagePct = pat.wastePct;
        document.getElementById('tileWastageInput').value = pat.wastePct;
      }
      updateLayingPatternDesc();
      saveState();
      renderTileResults();
    });

    // Module 2: Direct numeric fields
    [
      ['tileNetAreaInput', 'netArea', false],
      ['tileLengthInput', 'tileLength', true],
      ['tileWidthInput', 'tileWidth', true],
      ['tilePcsCartonInput', 'pcsPerCarton', false],
      ['tileWastageInput', 'wastagePct', false],
      ['tileUnitPriceInput', 'unitPrice', false],
      ['tileKgPerM2Input', 'kgPerM2', false],
      ['tileCbmPerM2Input', 'cbmPerM2', false],
    ].forEach(function (cfg) {
      document.getElementById(cfg[0]).addEventListener('input', function (e) {
        const val = parseFloat(e.target.value);
        state.tile[cfg[1]] = Number.isFinite(val) && val >= 0 ? val : 0;
        if (cfg[2]) {
          state.tile.presetId = 'custom';
          document.getElementById('tilePresetSelect').value = 'custom';
        }
        if (cfg[1] === 'wastagePct') {
          state.tile.patternId = 'custom';
          document.getElementById('layingPatternSelect').value = 'custom';
          updateLayingPatternDesc();
        }
        saveState();
        renderTileResults();
      });
    });
  }

  /* ===================== INIT ===================== */

  function init() {
    applyStaticI18n();
    syncFreightInputs();
    syncTileInputs();
    renderTabs();
    renderCargoList();
    renderContainerResults();
    renderTileResults();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
