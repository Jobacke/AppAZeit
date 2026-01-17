import { state } from '../store.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { showToast, formatDate } from './ui.js';

export function initExport() {
    window.exportXLSX = exportXLSX;
    window.exportPDF = exportPDF;
    window.exportCSV = exportCSV;
    window.exportJSON = exportJSON;
    window.importJSON = importJSON;
}


export function exportXLSX() {
    const period = document.getElementById('exportPeriod').value;
    let dataToExport = state.entries;

    if (period !== 'all') {
        const { start, end } = getExportDateRange(period);
        dataToExport = dataToExport.filter(e => e.datum >= start && e.datum <= end);
    }

    // Sort logic
    dataToExport.sort((a, b) => {
        if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
        return (a.start || '').localeCompare(b.start || '');
    });

    // Format data for export
    const formattedData = dataToExport.map(e => ({
        Datum: formatDate(e.datum),
        Start: e.start,
        Ende: e.ende,
        Projekt: e.projekt || '',
        Tätigkeit: e.taetigkeit || '',
        Stunden: e.stunden,
        Ort: e.homeoffice ? 'Homeoffice' : 'Büro'
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Zeiten");
    XLSX.writeFile(wb, `Zeiterfassung_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportPDF() {
    const doc = new jsPDF();
    const period = document.getElementById('exportPeriod').value;
    let dataToExport = state.entries;
    let dateRangeStr = "Alle Einträge";

    if (period !== 'all') {
        const { start, end } = getExportDateRange(period);
        dataToExport = dataToExport.filter(e => e.datum >= start && e.datum <= end);
        dateRangeStr = `${formatDate(start)} bis ${formatDate(end)}`;
    }

    // Sort: Date then Start
    dataToExport.sort((a, b) => {
        if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
        return (a.start || '').localeCompare(b.start || '');
    });

    // --- Statistics ---
    const totalHours = dataToExport.reduce((sum, e) => sum + (parseFloat(e.stunden) || 0), 0);
    const uniqueDays = new Set(dataToExport.map(e => e.datum)).size;
    const avgHoursPerDay = uniqueDays > 0 ? (totalHours / uniqueDays) : 0;
    const targetHours = 7.8; // Regelarbeitszeit
    const percentOfTarget = targetHours > 0 ? (avgHoursPerDay / targetHours) * 100 : 0;

    // --- Header ---
    doc.setFontSize(22);
    doc.text("Zeiterfassung", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const createdDate = new Date().toLocaleDateString('de-DE');
    doc.text(`Erstellt am: ${createdDate}`, 14, 28);

    doc.text(`${dataToExport.length} Einträge`, 14, 34);
    if (period !== 'all') {
        doc.text(`Zeitraum: ${dateRangeStr}`, 14, 40);
    }


    // --- Table ---
    const tableBody = dataToExport.map(e => [
        formatDate(e.datum),
        e.projekt || '',
        e.taetigkeit || '',
        e.start || '',
        e.ende || '',
        (parseFloat(e.stunden) || 0).toFixed(2),
        e.homeoffice ? 'HO' : 'Büro'
    ]);

    autoTable(doc, {
        head: [['Datum', 'Projekte', 'Tätigkeiten', 'Start', 'Ende', 'Std', 'Ort']],
        body: tableBody,
        startY: 45,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 66, 66] }, // Dark gray header
        alternateRowStyles: { fillColor: [245, 245, 245] },
        // Custom styling to match screenshot if needed
        didParseCell: (data) => {
            // E.g. align numbers
            if (data.column.index === 5) { // 'Std' column
                data.cell.styles.halign = 'right';
            }
        }
    });

    // --- Footer / Summary ---
    const finalY = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Gesamt: ${totalHours.toFixed(2)} Stunden`, 14, finalY);

    // Statistics Block
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("STATISTIK", 14, finalY + 10);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);

    doc.text(`Arbeitstage: ${uniqueDays}`, 14, finalY + 16);

    // Color for average lines
    const isGood = avgHoursPerDay >= targetHours;
    doc.setTextColor(isGood ? 0 : 200, isGood ? 100 : 0, 0); // simplistic color logic
    // Actually screenshot has Red for some, Black for others?
    // Screenshot: "Ø Stunden/Tag: 7.50h" (Red) -> because < 7.8
    // "Ø % zur Regelarbeitszeit (7,8h): 96.2%" (Red)

    if (avgHoursPerDay < targetHours) {
        doc.setTextColor(220, 50, 50); // Red
    } else {
        doc.setTextColor(0, 150, 0); // Green
    }

    doc.text(`Ø Stunden/Tag: ${avgHoursPerDay.toFixed(2)}h`, 14, finalY + 22);
    doc.text(`Ø % zur Regelarbeitszeit (${targetHours.toString().replace('.', ',')}h): ${percentOfTarget.toFixed(1)}%`, 14, finalY + 28);


    doc.save(`Zeiterfassung_${new Date().toISOString().split('T')[0]}.pdf`);
}

function getExportDateRange(period) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let start = today;
    let end = today;

    if (period === 'custom') {
        start = document.getElementById('exportFrom').value;
        end = document.getElementById('exportTo').value;
    } else if (period === 'week') {
        const day = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - day + 1);
        start = monday.toISOString().split('T')[0];
    } else if (period === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]; // Last day of month
    } else if (period === 'year') {
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
    }
    return { start, end };
}

window.toggleCustomDates = function () {
    const period = document.getElementById('exportPeriod').value;
    const customRange = document.getElementById('customDateRange');
    if (period === 'custom') {
        customRange.classList.remove('hidden');
    } else {
        customRange.classList.add('hidden');
    }
}

export function exportCSV() {
    const period = document.getElementById('exportPeriod').value;
    let dataToExport = state.entries;

    if (period !== 'all') {
        const { start, end } = getExportDateRange(period);
        dataToExport = dataToExport.filter(e => e.datum >= start && e.datum <= end);
    }

    dataToExport.sort((a, b) => {
        if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
        return (a.start || '').localeCompare(b.start || '');
    });

    const headers = ['Datum', 'Start', 'Ende', 'Projekt', 'Tätigkeit', 'Stunden', 'Ort'];
    const csvContent = [
        headers.join(';'),
        ...dataToExport.map(e => [
            formatDate(e.datum),
            e.start,
            e.ende,
            e.projekt || '',
            e.taetigkeit || '',
            e.stunden,
            e.homeoffice ? 'Homeoffice' : 'Büro'
        ].join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Zeiterfassung_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

export function exportJSON() {
    const period = document.getElementById('exportPeriod').value;
    let dataToExport = state.entries;

    if (period !== 'all') {
        const { start, end } = getExportDateRange(period);
        dataToExport = dataToExport.filter(e => e.datum >= start && e.datum <= end);
    }

    dataToExport.sort((a, b) => {
        if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
        return (a.start || '').localeCompare(b.start || '');
    });

    // For JSON we keep raw data but sorted, as JSON is usually for machine processing
    // However, if the user wants it "like the others", we might format it. 
    // Standard practice for JSON export is raw data. I will keep raw data for JSON to allow re-import.

    const jsonContent = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Zeiterfassung_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

export function importJSON() {
    // Stub
}

