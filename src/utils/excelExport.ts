import * as XLSX from 'xlsx-js-style';
import { CategoryType, BudgetEntry } from '../types';

interface ExportData {
  currentMonth: string;
  currentTotals: Record<CategoryType, number>;
  netFlow: number;
  totalGoalsSaved: number;
  currentBudgetEntries: BudgetEntry[];
}

export const exportToExcel = ({
  currentMonth,
  currentTotals,
  netFlow,
  totalGoalsSaved,
  currentBudgetEntries
}: ExportData) => {
  // ESTILOS COMUNES
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E293B" } }, // Slate-800
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  const cellStyle = {
    alignment: { vertical: "center" },
    border: {
      bottom: { style: "thin", color: { rgb: "E2E8F0" } }
    }
  };

  const currencyStyle = {
    ...cellStyle,
    alignment: { horizontal: "right" },
    numFmt: '"$"#,##0.00' // Formato moneda
  };

  // --- HOJA 1: RESUMEN FINANCIERO (Dashboard) ---
  // Preparamos datos del resumen con una estructura más limpia
  const summaryRows = [
    { Concepto: 'Ingresos Totales', Monto: currentTotals[CategoryType.INCOME] || 0 },
    { Concepto: 'Gastos Fijos', Monto: currentTotals[CategoryType.FIXED_EXPENSE] || 0 },
    { Concepto: 'Gastos Variables', Monto: currentTotals[CategoryType.VARIABLE_EXPENSE] || 0 },
    { Concepto: 'Pagos de Deuda', Monto: currentTotals[CategoryType.DEBT] || 0 },
    { Concepto: 'Ahorro Real', Monto: (currentTotals[CategoryType.SAVINGS] || 0) + totalGoalsSaved },
    { Concepto: 'BALANCE NETO', Monto: netFlow } // Fila destacada
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

  // Aplicar anchos de columna al Resumen
  wsSummary['!cols'] = [
    { wch: 30 }, // Concepto
    { wch: 20 }  // Monto
  ];

  // Aplicar estilos al Resumen
  // Header (Fila 1)
  ['A1', 'B1'].forEach(cell => {
    if(wsSummary[cell]) wsSummary[cell].s = headerStyle;
  });

  // Celdas de datos (A partir de Fila 2)
  summaryRows.forEach((row, i) => {
    const rowIndex = i + 2;
    const isBalance = row.Concepto === 'BALANCE NETO';
    
    // Estilo base para la fila
    const rowStyle = isBalance ? { 
      ...cellStyle, 
      font: { bold: true, color: { rgb: row.Monto >= 0 ? "10B981" : "EF4444" } }, // Verde o Rojo
      fill: { fgColor: { rgb: "F1F5F9" } } 
    } : cellStyle;

    // Aplicar a Concepto
    if(wsSummary[`A${rowIndex}`]) wsSummary[`A${rowIndex}`].s = rowStyle;

    // Aplicar a Monto (con formato moneda)
    if(wsSummary[`B${rowIndex}`]) {
      wsSummary[`B${rowIndex}`].s = { 
        ...rowStyle, 
        alignment: { horizontal: "right" },
        numFmt: '"$"#,##0.00' 
      };
    }
  });


  // --- HOJA 2: DETALLE MOVIMIENTOS ---
  const entriesData = currentBudgetEntries.map(e => ({
    Fecha: e.date, // Se mantendrá como string YYYY-MM-DD para compatibilidad, o objeto Date
    Concepto: e.name,
    Categoría: e.category,
    Etiqueta: e.tag,
    Monto: e.amount, // Número puro para que el formato funcione
    Método: e.paymentMethod,
    Estado: e.status,
    Tarjeta: e.cardName || '-',
    Cuota: e.currentInstallment ? `${e.currentInstallment}/${e.totalInstallments}` : '-'
  }));

  const wsEntries = XLSX.utils.json_to_sheet(entriesData);

  // Definir anchos de columna para Movimientos
  wsEntries['!cols'] = [
    { wch: 12 }, // Fecha
    { wch: 35 }, // Concepto
    { wch: 20 }, // Categoría
    { wch: 20 }, // Etiqueta
    { wch: 15 }, // Monto
    { wch: 15 }, // Método
    { wch: 12 }, // Estado
    { wch: 15 }, // Tarjeta
    { wch: 10 }  // Cuota
  ];

  // Aplicar estilos a Movimientos
  const range = XLSX.utils.decode_range(wsEntries['!ref'] || 'A1:A1');
  
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!wsEntries[cellRef]) continue;

      // Estilo Header
      if (R === 0) {
        wsEntries[cellRef].s = headerStyle;
      } else {
        // Estilo Datos
        // Columna E es Monto (Index 4)
        if (C === 4) {
          wsEntries[cellRef].s = currencyStyle;
        } 
        // Columna A es Fecha (Index 0)
        else if (C === 0) {
          // Intentar convertir string fecha a Date para formato real si es necesario, 
          // pero si ya viene YYYY-MM-DD visualmente está bien, solo centramos.
          wsEntries[cellRef].s = { ...cellStyle, alignment: { horizontal: "center" } };
        }
        else {
          wsEntries[cellRef].s = cellStyle;
        }
      }
    }
  }

  // 3. Create Workbook and Sheets
  const wb = XLSX.utils.book_new();
  
  // Primero Resumen (lo más importante)
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Financiero");
  XLSX.utils.book_append_sheet(wb, wsEntries, "Detalle Movimientos");

  // 4. Save file
  XLSX.writeFile(wb, `Reporte_Finanzas_${currentMonth}.xlsx`);
};
