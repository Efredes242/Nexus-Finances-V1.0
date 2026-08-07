import { utils, writeFile } from 'xlsx-js-style';
import { BudgetEntry, CategoryType, TransactionStatus } from '../types';

export const generateProfessionalExcel = (
    entries: BudgetEntry[],
    currentMonth: string,
    totals: Record<CategoryType, number>
) => {
    // Helpers
    const formatCurrency = (val: number) => {
        return { t: 'n', v: val, z: '$ #,##0.00' };
    };

    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4F46E5" } }, // Indigo 600
        alignment: { horizontal: "center" },
        border: { bottom: { style: "thin", color: { rgb: "000000" } } }
    };

    const createSheet = (title: string, dataEntries: BudgetEntry[]) => {
        const headers = ["Fecha", "Concepto", "Categoría", "Etiqueta", "Método", "Estado", "Monto", "Cuotas"];
        const rows = dataEntries.map(e => [
            e.date,
            e.name,
            e.category,
            e.tag,
            e.paymentMethod,
            e.status === TransactionStatus.PAID ? 'PAGADO' : 'PENDIENTE',
            e.amount, // Value for format
            e.installmentRef ? `${e.currentInstallment}/${e.totalInstallments}` : '-'
        ]);

        const ws = utils.aoa_to_sheet([headers, ...rows]);

        // Apply Styles
        const range = utils.decode_range(ws['!ref'] || "A1:A1");

        // Header Styling
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = utils.encode_cell({ r: 0, c: C });
            if (!ws[address]) continue;
            ws[address].s = headerStyle;
        }

        // Number Formatting for Amount (Col G -> index 6)
        for (let R = 1; R <= range.e.r; ++R) {
            const address = utils.encode_cell({ r: R, c: 6 });
            if (!ws[address]) continue;
            ws[address].t = 'n';
            ws[address].z = '$ #,##0.00';
        }

        // Column Widths
        ws['!cols'] = [
            { wch: 12 }, // Date
            { wch: 30 }, // Name
            { wch: 20 }, // Category
            { wch: 15 }, // Tag
            { wch: 15 }, // Method
            { wch: 12 }, // Status
            { wch: 15 }, // Amount
            { wch: 10 }  // Installments
        ];

        return ws;
    };

    const wb = utils.book_new();

    // 1. Resumen Sheet
    const resumenWs = utils.aoa_to_sheet([
        ["RESUMEN FINANCIERO", currentMonth],
        [""],
        ["Categoría", "Total"],
        ["Ingresos", totals[CategoryType.INCOME]],
        ["Gastos Fijos", totals[CategoryType.FIXED_EXPENSE]],
        ["Gastos Variables", totals[CategoryType.VARIABLE_EXPENSE]],
        ["Gastos Compartidos", totals[CategoryType.SHARED_EXPENSE]],
        ["Metas / Ahorro", totals[CategoryType.SAVINGS]],
        ["", ""],
        ["BALANCE NETO", (totals[CategoryType.INCOME] - (totals[CategoryType.FIXED_EXPENSE] + totals[CategoryType.VARIABLE_EXPENSE] + totals[CategoryType.SHARED_EXPENSE] + totals[CategoryType.SAVINGS]))]
    ]);

    // Style Resumen
    resumenWs['B4'].z = '$ #,##0.00';
    resumenWs['B5'].z = '$ #,##0.00';
    resumenWs['B6'].z = '$ #,##0.00';
    resumenWs['B7'].z = '$ #,##0.00';
    resumenWs['B8'].z = '$ #,##0.00';
    resumenWs['B10'].z = '$ #,##0.00';
    resumenWs['!cols'] = [{ wch: 25 }, { wch: 20 }];

    utils.book_append_sheet(wb, resumenWs, "Resumen Global");

    // 2. Creating Sheets by Category groups
    const incomeEntries = entries.filter(e => e.category === CategoryType.INCOME);
    const expenseEntries = entries.filter(e => e.category !== CategoryType.INCOME && e.category !== CategoryType.SAVINGS);
    const savingsEntries = entries.filter(e => e.category === CategoryType.SAVINGS);

    if (incomeEntries.length) utils.book_append_sheet(wb, createSheet("Ingresos", incomeEntries), "Ingresos");
    if (expenseEntries.length) utils.book_append_sheet(wb, createSheet("Gastos", expenseEntries), "Gastos");
    if (savingsEntries.length) utils.book_append_sheet(wb, createSheet("Ahorros", savingsEntries), " Ahorros");

    writeFile(wb, `Nexus_Finance_${currentMonth}.xlsx`);
};
