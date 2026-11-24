(function (global) {
  'use strict';

  const SQFT_PER_M2 = 10.7639104167;
  const MM_PER_INCH = 25.4;

  function toNum(val, fallback) {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? n : (fallback || 0);
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function round3(n) {
    return Math.round((n + Number.EPSILON) * 1000) / 1000;
  }

  function getContainerSpecs(containers, weightProfile) {
    const isNA = weightProfile === 'north_america';
    return {
      '20GP': {
        code: '20GP',
        cbm: containers['20GP'].usableCbm,
        wtKg: isNA ? containers['20GP'].maxWeightNorthAmericaKg : containers['20GP'].maxWeightStandardKg,
      },
      '40GP': {
        code: '40GP',
        cbm: containers['40GP'].usableCbm,
        wtKg: isNA ? containers['40GP'].maxWeightNorthAmericaKg : containers['40GP'].maxWeightStandardKg,
      },
      '40HQ': {
        code: '40HQ',
        cbm: containers['40HQ'].usableCbm,
        wtKg: isNA ? containers['40HQ'].maxWeightNorthAmericaKg : containers['40HQ'].maxWeightStandardKg,
      },
    };
  }

  function formatContainerLabel(n20, n40gp, n40hq) {
    const parts = [];
    if (n40hq > 0) parts.push(n40hq + ' × 40HQ');
    if (n40gp > 0) parts.push(n40gp + ' × 40GP');
    if (n20 > 0) parts.push(n20 + ' × 20GP');
    return parts.join(' + ') || '0';
  }

  function evaluateFclCombo(n20, n40gp, n40hq, specs, rates, totalCbm, totalWeightKg) {
    const capCbm = n20 * specs['20GP'].cbm + n40gp * specs['40GP'].cbm + n40hq * specs['40HQ'].cbm;
    const capWtKg = n20 * specs['20GP'].wtKg + n40gp * specs['40GP'].wtKg + n40hq * specs['40HQ'].wtKg;
    const oceanFreight = n20 * rates.rate20GP + n40gp * rates.rate40GP + n40hq * rates.rate40HQ;
    const containerCount = n20 + n40gp + n40hq;
    const volUtilPct = capCbm > 0 ? (totalCbm / capCbm) * 100 : 0;
    const wtUtilPct = capWtKg > 0 ? (totalWeightKg / capWtKg) * 100 : 0;

    return {
      mode: 'FCL',
      label: formatContainerLabel(n20, n40gp, n40hq),
      counts: { '20GP': n20, '40GP': n40gp, '40HQ': n40hq },
      containerCount: containerCount,
      capCbm: capCbm,
      capWtKg: capWtKg,
      oceanFreight: oceanFreight,
      totalShipping: oceanFreight + rates.localFees,
      volUtilPct: volUtilPct,
      wtUtilPct: wtUtilPct,
      remainingCbm: Math.max(0, capCbm - totalCbm),
      remainingWeightKg: Math.max(0, capWtKg - totalWeightKg),
    };
  }

  /**
   * Finds the lowest-cost FCL container combination meeting both CBM and weight constraints.
   */
  function findOptimalFcl(totalCbm, totalWeightKg, specs, rates) {
    // Handle very large projects (> 15 containers) by peeling off bulk containers of the best-value type
    let base20 = 0;
    let base40gp = 0;
    let base40hq = 0;
    let remCbm = totalCbm;
    let remWt = totalWeightKg;

    const maxSingle20 = Math.max(
      Math.ceil(totalCbm / specs['20GP'].cbm),
      Math.ceil(totalWeightKg / specs['20GP'].wtKg)
    );

    if (maxSingle20 > 18) {
      // Determine dominant constraint density
      const isWeightDominant =
        (totalWeightKg / specs['40HQ'].wtKg) > (totalCbm / specs['40HQ'].cbm);
      const candidates = ['20GP', '40GP', '40HQ'].map(function (code) {
        const rate = rates['rate' + code];
        const metric = isWeightDominant ? specs[code].wtKg : specs[code].cbm;
        return { code: code, costPerCap: rate / metric };
      });
      candidates.sort(function (a, b) {
        return a.costPerCap - b.costPerCap;
      });
      const bulkCode = candidates[0].code;
      const bulkSafeCount = Math.max(
        0,
        Math.min(
          Math.floor(remCbm / specs[bulkCode].cbm),
          Math.floor(remWt / specs[bulkCode].wtKg)
        ) - 4
      );
      if (bulkSafeCount > 0) {
        if (bulkCode === '20GP') base20 += bulkSafeCount;
        if (bulkCode === '40GP') base40gp += bulkSafeCount;
        if (bulkCode === '40HQ') base40hq += bulkSafeCount;
        remCbm = Math.max(0, remCbm - bulkSafeCount * specs[bulkCode].cbm);
        remWt = Math.max(0, remWt - bulkSafeCount * specs[bulkCode].wtKg);
      }
    }

    const max20 = Math.max(
      Math.ceil(remCbm / specs['20GP'].cbm),
      Math.ceil(remWt / specs['20GP'].wtKg)
    );
    const max40gp = Math.max(
      Math.ceil(remCbm / specs['40GP'].cbm),
      Math.ceil(remWt / specs['40GP'].wtKg)
    );
    const max40hq = Math.max(
      Math.ceil(remCbm / specs['40HQ'].cbm),
      Math.ceil(remWt / specs['40HQ'].wtKg)
    );

    let best = null;

    for (let n40hq = 0; n40hq <= max40hq; n40hq++) {
      for (let n40gp = 0; n40gp <= max40gp; n40gp++) {
        const cbmCovered = n40hq * specs['40HQ'].cbm + n40gp * specs['40GP'].cbm;
        const wtCovered = n40hq * specs['40HQ'].wtKg + n40gp * specs['40GP'].wtKg;
        const needCbm = Math.max(0, remCbm - cbmCovered);
        const needWt = Math.max(0, remWt - wtCovered);

        const n20 = Math.max(
          Math.ceil(needCbm / specs['20GP'].cbm),
          Math.ceil(needWt / specs['20GP'].wtKg)
        );
        if (n20 > max20) continue;

        const total20 = base20 + n20;
        const total40gp = base40gp + n40gp;
        const total40hq = base40hq + n40hq;
        if (total20 + total40gp + total40hq === 0) continue;

        const combo = evaluateFclCombo(
          total20,
          total40gp,
          total40hq,
          specs,
          rates,
          totalCbm,
          totalWeightKg
        );

        if (
          !best ||
          combo.oceanFreight < best.oceanFreight - 0.01 ||
          (Math.abs(combo.oceanFreight - best.oceanFreight) <= 0.01 &&
            combo.containerCount < best.containerCount) ||
          (Math.abs(combo.oceanFreight - best.oceanFreight) <= 0.01 &&
            combo.containerCount === best.containerCount &&
            combo.capCbm > best.capCbm)
        ) {
          best = combo;
        }
      }
    }

    return best;
  }

  /**
   * Main Container Load & Freight Calculation Engine (Module 1).
   */
  function calculateContainerPlan(params) {
    const items = Array.isArray(params.items) ? params.items : [];
    const containers = params.containers;
    const weightProfile = params.weightProfile || 'standard';
    const rates = {
      lclPerCbm: toNum(params.rates && params.rates.lclPerCbm, 100),
      rate20GP: toNum(params.rates && params.rates.rate20GP, 2000),
      rate40GP: toNum(params.rates && params.rates.rate40GP, 2800),
      rate40HQ: toNum(params.rates && params.rates.rate40HQ, 3000),
      localFees: toNum(params.rates && params.rates.localFees, 500),
    };

    let totalCbm = 0;
    let totalWeightKg = 0;
    let totalFobUsd = 0;

    const lineSummaries = items.map(function (item) {
      const qty = toNum(item.qty, 0);
      const cbmPerUnit = toNum(item.cbmPerUnit, 0);
      const kgPerUnit = toNum(item.kgPerUnit, 0);
      const unitPriceUsd = toNum(item.unitPriceUsd, 0);

      const lineCbm = qty * cbmPerUnit;
      const lineWeightKg = qty * kgPerUnit;
      const lineValueUsd = qty * unitPriceUsd;

      totalCbm += lineCbm;
      totalWeightKg += lineWeightKg;
      totalFobUsd += lineValueUsd;

      return {
        qty: qty,
        lineCbm: lineCbm,
        lineWeightKg: lineWeightKg,
        lineValueUsd: lineValueUsd,
      };
    });

    if (totalCbm <= 0 && totalWeightKg <= 0) {
      return {
        hasCargo: false,
        lineSummaries: lineSummaries,
        totalCbm: 0,
        totalWeightKg: 0,
        totalWeightMt: 0,
        totalFobUsd: totalFobUsd,
      };
    }

    const specs = getContainerSpecs(containers, weightProfile);

    // LCL Option (W/M rule: 1 CBM or 1000 kg, min 1 RT)
    const weightTons = totalWeightKg / 1000;
    const chargeableRT = Math.max(1, totalCbm, weightTons);
    const lclOceanFreight = chargeableRT * rates.lclPerCbm;
    // LCL fixed local fees are typically lower than FCL, use full localFees entered by user for transparency
    const lclOption = {
      mode: 'LCL',
      label: 'LCL (' + round2(chargeableRT) + ' W/M)',
      chargeableRT: chargeableRT,
      isWeightBilled: weightTons > totalCbm,
      oceanFreight: lclOceanFreight,
      totalShipping: lclOceanFreight + rates.localFees,
      volUtilPct: null,
      wtUtilPct: null,
      eligible: totalCbm <= 18 && weightTons <= 15,
    };

    // Single-type FCL options for side-by-side comparison
    const count20 = Math.max(
      Math.ceil(totalCbm / specs['20GP'].cbm),
      Math.ceil(totalWeightKg / specs['20GP'].wtKg)
    );
    const count40gp = Math.max(
      Math.ceil(totalCbm / specs['40GP'].cbm),
      Math.ceil(totalWeightKg / specs['40GP'].wtKg)
    );
    const count40hq = Math.max(
      Math.ceil(totalCbm / specs['40HQ'].cbm),
      Math.ceil(totalWeightKg / specs['40HQ'].wtKg)
    );

    const opt20 = evaluateFclCombo(count20, 0, 0, specs, rates, totalCbm, totalWeightKg);
    const opt40gp = evaluateFclCombo(0, count40gp, 0, specs, rates, totalCbm, totalWeightKg);
    const opt40hq = evaluateFclCombo(0, 0, count40hq, specs, rates, totalCbm, totalWeightKg);
    const optimalFcl = findOptimalFcl(totalCbm, totalWeightKg, specs, rates);

    // Pick recommended overall option: LCL if eligible and cheaper than optimal FCL, else optimal FCL
    const recommended =
      lclOption.eligible && lclOption.oceanFreight < optimalFcl.oceanFreight
        ? lclOption
        : optimalFcl;

    // Determine binding constraint for FCL (or based on W/M for LCL)
    let bindingConstraint = 'balanced';
    if (recommended.mode === 'FCL') {
      const diff = recommended.wtUtilPct - recommended.volUtilPct;
      if (diff > 8) bindingConstraint = 'weight';
      else if (diff < -8) bindingConstraint = 'volume';
      else bindingConstraint = 'balanced';
    } else {
      const ratioWtToVol = totalCbm > 0 ? (weightTons / totalCbm) : 1;
      if (ratioWtToVol > 1.05) bindingConstraint = 'weight';
      else if (ratioWtToVol < 0.7) bindingConstraint = 'volume';
      else bindingConstraint = 'balanced';
    }

    // Build deduplicated comparison list
    const comparisonMap = {};
    const comparisonList = [];

    function pushComparison(opt) {
      if (!comparisonMap[opt.label]) {
        comparisonMap[opt.label] = true;
        comparisonList.push(opt);
      }
    }

    if (lclOption.eligible || totalCbm <= 25) {
      pushComparison(lclOption);
    }
    pushComparison(opt20);
    pushComparison(opt40gp);
    pushComparison(opt40hq);
    pushComparison(optimalFcl);

    comparisonList.sort(function (a, b) {
      return a.totalShipping - b.totalShipping;
    });

    const freightRatioPct =
      totalFobUsd > 0 ? (recommended.totalShipping / totalFobUsd) * 100 : 0;
    const freightPerCbm = totalCbm > 0 ? recommended.totalShipping / totalCbm : 0;

    return {
      hasCargo: true,
      lineSummaries: lineSummaries,
      totalCbm: totalCbm,
      totalWeightKg: totalWeightKg,
      totalWeightMt: weightTons,
      totalFobUsd: totalFobUsd,
      recommended: recommended,
      optimalFcl: optimalFcl,
      lclOption: lclOption,
      bindingConstraint: bindingConstraint,
      comparisonList: comparisonList,
      freightRatioPct: freightRatioPct,
      freightPerCbm: freightPerCbm,
      estLandedUsd: totalFobUsd + recommended.totalShipping,
      fixedFeesUsd: rates.localFees,
    };
  }

  /**
   * Tile & Stone Wastage & Budget Estimator (Module 2).
   */
  function calculateTileEstimate(params) {
    const unitSystem = params.unitSystem === 'imperial' ? 'imperial' : 'metric';
    const rawNetArea = toNum(params.netArea, 0);
    const rawTileLength = toNum(params.tileLength, 600);
    const rawTileWidth = toNum(params.tileWidth, 600);
    const pcsPerCarton = Math.max(1, Math.round(toNum(params.pcsPerCarton, 1)));
    const wastagePct = toNum(params.wastagePct, 10);
    const unitPricePerDisplayArea = toNum(params.unitPrice, 0);
    const kgPerM2 = toNum(params.kgPerM2, 22);
    const cbmPerM2 = toNum(params.cbmPerM2, 0.0155);

    // Convert to canonical metric (m2, mm)
    const netAreaM2 = unitSystem === 'imperial' ? rawNetArea / SQFT_PER_M2 : rawNetArea;
    const lengthMm = unitSystem === 'imperial' ? rawTileLength * MM_PER_INCH : rawTileLength;
    const widthMm = unitSystem === 'imperial' ? rawTileWidth * MM_PER_INCH : rawTileWidth;

    if (netAreaM2 <= 0 || lengthMm <= 0 || widthMm <= 0) {
      return {
        valid: false,
        unitSystem: unitSystem,
      };
    }

    const pieceAreaM2 = (lengthMm * widthMm) / 1000000;
    const wastageAreaM2 = netAreaM2 * (wastagePct / 100);
    const requiredAreaM2 = netAreaM2 + wastageAreaM2;

    const exactPieces = Math.ceil(requiredAreaM2 / pieceAreaM2);
    const cartonsToOrder = Math.ceil(exactPieces / pcsPerCarton);
    const orderPieces = cartonsToOrder * pcsPerCarton;

    const cartonCoverageM2 = pieceAreaM2 * pcsPerCarton;
    const actualPurchasedAreaM2 = orderPieces * pieceAreaM2;

    // Unit price conversion: price entered is per m2 (metric) or per sq ft (imperial)
    const pricePerM2Usd =
      unitSystem === 'imperial'
        ? unitPricePerDisplayArea * SQFT_PER_M2
        : unitPricePerDisplayArea;

    const estBudgetUsd = actualPurchasedAreaM2 * pricePerM2Usd;
    const estWeightKg = actualPurchasedAreaM2 * kgPerM2;
    const estCbm = actualPurchasedAreaM2 * cbmPerM2;

    // Display values in active unit system
    const areaFactor = unitSystem === 'imperial' ? SQFT_PER_M2 : 1;

    return {
      valid: true,
      unitSystem: unitSystem,
      areaUnitLabel: unitSystem === 'imperial' ? 'sq ft' : 'm²',
      dimUnitLabel: unitSystem === 'imperial' ? 'in' : 'mm',
      isSlab: pcsPerCarton === 1,
      netAreaM2: netAreaM2,
      wastageAreaM2: wastageAreaM2,
      requiredAreaM2: requiredAreaM2,
      actualPurchasedAreaM2: actualPurchasedAreaM2,
      cartonCoverageM2: cartonCoverageM2,
      netAreaDisplay: netAreaM2 * areaFactor,
      wastageAreaDisplay: wastageAreaM2 * areaFactor,
      requiredAreaDisplay: requiredAreaM2 * areaFactor,
      actualPurchasedAreaDisplay: actualPurchasedAreaM2 * areaFactor,
      cartonCoverageDisplay: cartonCoverageM2 * areaFactor,
      wastagePct: wastagePct,
      exactPieces: exactPieces,
      pcsPerCarton: pcsPerCarton,
      cartonsToOrder: cartonsToOrder,
      orderPieces: orderPieces,
      pricePerM2Usd: pricePerM2Usd,
      estBudgetUsd: estBudgetUsd,
      estWeightKg: estWeightKg,
      estCbm: estCbm,
      kgPerM2: kgPerM2,
      cbmPerM2: cbmPerM2,
      lengthMm: lengthMm,
      widthMm: widthMm,
    };
  }

  const exportsObj = {
    SQFT_PER_M2: SQFT_PER_M2,
    MM_PER_INCH: MM_PER_INCH,
    round2: round2,
    round3: round3,
    calculateContainerPlan: calculateContainerPlan,
    calculateTileEstimate: calculateTileEstimate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  } else {
    global.BMCCalc = exportsObj;
  }
})(typeof window !== 'undefined' ? window : globalThis);
