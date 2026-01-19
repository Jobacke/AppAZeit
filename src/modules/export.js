import { state } from '../store.js';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { showToast, formatDate } from './ui.js';

export function initExport() {
    window.exportXLSX = exportXLSX;
    window.exportPDF = exportPDF;
    window.exportCSV = exportCSV;
    window.exportJSON = exportJSON;
    window.importJSON = importJSON;
}

function getToday() {
    return new Date().toISOString().split('T')[0];
}

function calculateHours(start, ende) {
    if (!start || !ende) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = ende.split(':').map(Number);
    const min1 = h1 * 60 + m1;
    const min2 = h2 * 60 + m2;
    return Math.round((min2 - min1) / 60 * 100) / 100;
}

function getExportEntries() {
    const period = document.getElementById('exportPeriod').value;
    let dataToExport = state.entries;

    if (period !== 'all') {
        const { start, end } = getExportDateRange(period);
        dataToExport = dataToExport.filter(e => e.datum >= start && e.datum <= end);
    }
    return dataToExport;
}

export function exportPDF() {
    const rawData = getExportEntries();
    if (rawData.length === 0) { alert('Keine Daten zum Exportieren'); return; }

    // Zusammenhängende Zeiten zusammenfassen
    const data = mergeConsecutiveEntries(rawData);

    // Querformat: 'l' = landscape
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFontSize(18);
    doc.text('Zeiterfassung', 14, 22);
    doc.setFontSize(10);
    doc.text(`Erstellt am: ${formatDate(getToday())}`, 14, 30);
    doc.text(`${data.length} Zeitblöcke (aus ${rawData.length} Einträgen)`, 14, 36);

    let y = 50;
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    // Spaltenbreiten angepasst: Datum, Start, Ende, Stunden, Ort reduziert; Projekte und Tätigkeiten erweitert
    doc.text('Datum', 14, y);
    doc.text('Projekte', 40, y);
    doc.text('Tätigkeiten', 110, y);
    doc.text('Start', 195, y);
    doc.text('Ende', 212, y);
    doc.text('Std', 230, y);
    doc.text('Ort', 250, y);

    // Linie unter Kopfzeile
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, y, 270, y);

    doc.setFont(undefined, 'normal');
    y += 6;

    let currentDay = null;
    let dayCounter = 0;

    data.forEach((e, index) => {
        // Calculate wrapped text and dimensions first
        const projectText = (e.projekte || []).join(', ');
        const projectLines = doc.splitTextToSize(projectText, 65); // Max width approx 65mm

        let actStr = (e.taetigkeiten || []).join(', ');
        if (e.entryCount > 1) {
            actStr += " und weitere Tätigkeiten";
        }
        const activityLines = doc.splitTextToSize(actStr, 80); // Max width approx 80mm

        const maxLines = Math.max(projectLines.length, activityLines.length, 1);
        const rowHeight = Math.max(6, maxLines * 4 + 2); // Dynamic height calculation

        // Check page break with new rowHeight
        if (y + rowHeight > 190) { doc.addPage(); y = 20; currentDay = null; }

        // Tagwechsel erkennen
        const isDayChange = e.datum !== currentDay;
        if (isDayChange) {
            currentDay = e.datum;
            dayCounter++;
        }

        // Hintergrundfarbe pro Tag alternierend
        if (dayCounter % 2 === 0) {
            doc.setFillColor(240, 255, 240); // Dezentes Grün
            doc.rect(10, y - 4, 277, rowHeight, 'F');
        }

        // Trennlinie vor neuem Tag
        if (isDayChange && index > 0) {
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.4);
            doc.line(14, y - 3, 270, y - 3);
        }

        // Text
        doc.setTextColor(0, 0, 0);
        doc.text(formatDate(e.datum), 14, y);
        doc.text(projectLines, 40, y);
        doc.text(activityLines, 110, y);
        doc.text(e.start || '', 195, y);
        doc.text(e.ende || '', 212, y);
        doc.text((e.stunden || 0).toFixed(2), 230, y);
        doc.text(e.homeoffice ? 'HO' : 'Büro', 250, y);

        y += rowHeight;
    });

    // Filter out Pause entries for statistics
    const workingData = data.filter(e => !e.projekte.includes('Pause'));
    const totalHours = workingData.reduce((sum, e) => sum + (e.stunden || 0), 0);

    // Statistik berechnen
    const uniqueDates = [...new Set(workingData.map(e => e.datum))];
    const workDays = uniqueDates.length;
    const avgPerDay = workDays > 0 ? totalHours / workDays : 0;
    const regelarbeitszeit = 7.8;
    const percentOfRegular = regelarbeitszeit > 0 ? (avgPerDay / regelarbeitszeit * 100) : 0;

    // Homeoffice vs. Büro (only counting working hours)
    const hoHours = workingData.filter(e => e.homeoffice).reduce((sum, e) => sum + (e.stunden || 0), 0);
    const officeHours = workingData.filter(e => !e.homeoffice).reduce((sum, e) => sum + (e.stunden || 0), 0);
    const hoPct = totalHours > 0 ? (hoHours / totalHours * 100) : 0;
    const officePct = totalHours > 0 ? (officeHours / totalHours * 100) : 0;

    // Wochenarbeitszeit (Hochrechnung auf 5-Tage-Woche)
    const weekHours = avgPerDay * 5;
    const weekPercent = (weekHours / 39) * 100;

    y += 5;
    doc.setFont(undefined, 'bold');
    doc.text(`Gesamt: ${totalHours.toFixed(2)} Stunden`, 14, y);

    y += 10;
    doc.setFontSize(11);
    doc.text('STATISTIK', 14, y);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    y += 6;
    doc.text(`Arbeitstage: ${workDays}`, 14, y);
    y += 5;

    // Ø Stunden/Tag - farblich markieren
    const avgDayColor = avgPerDay < 7.8 ? [255, 0, 0] : [0, 170, 0]; // Rot oder Grün
    doc.setTextColor(avgDayColor[0], avgDayColor[1], avgDayColor[2]);
    doc.setFont(undefined, 'bold');
    doc.text(`Ø Stunden/Tag: ${avgPerDay.toFixed(2)}h`, 14, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0); // Zurück zu Schwarz
    y += 5;

    // % zur Regelarbeitszeit - farblich markieren
    const percentColor = percentOfRegular < 100 ? [255, 0, 0] : [0, 170, 0]; // Rot oder Grün
    doc.setTextColor(percentColor[0], percentColor[1], percentColor[2]);
    doc.setFont(undefined, 'bold');
    doc.text(`Ø % zur Regelarbeitszeit (7,8h): ${percentOfRegular.toFixed(1)}%`, 14, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0); // Zurück zu Schwarz
    y += 5;

    // Wochenarbeitszeit - farblich markieren
    const weekHoursColor = weekHours < 39 ? [255, 0, 0] : [0, 170, 0]; // Rot oder Grün
    doc.setTextColor(weekHoursColor[0], weekHoursColor[1], weekHoursColor[2]);
    doc.setFont(undefined, 'bold');
    doc.text(`Hochrechnung Woche (5 Tage): ${weekHours.toFixed(2)}h (${weekPercent.toFixed(1)}%)`, 14, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0); // Zurück zu Schwarz

    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text('ARBEITSORT-VERTEILUNG', 14, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    doc.text(`Homeoffice: ${hoHours.toFixed(2)}h (${hoPct.toFixed(1)}%)`, 14, y);
    y += 5;

    // Büro-Prozent - farblich markieren
    const bueroColor = officePct < 50 ? [255, 0, 0] : [0, 170, 0]; // Rot oder Grün
    doc.setTextColor(bueroColor[0], bueroColor[1], bueroColor[2]);
    doc.setFont(undefined, 'bold');
    doc.text(`Büro: ${officeHours.toFixed(2)}h (${officePct.toFixed(1)}%)`, 14, y);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0); // Zurück zu Schwarz

    doc.save(`Zeiterfassung_${getToday()}.pdf`);
}

function mergeConsecutiveEntries(data) {
    // Sortieren nach Datum und Startzeit
    const sorted = [...data].sort((a, b) => {
        if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
        return (a.start || '').localeCompare(b.start || '');
    });

    const merged = [];
    let current = null;

    for (const entry of sorted) {
        if (!current) {
            // Erster Eintrag
            current = {
                datum: entry.datum,
                start: entry.start,
                ende: entry.ende,
                projekte: [entry.projekt || 'Allgemein'],
                taetigkeiten: entry.taetigkeit ? [entry.taetigkeit] : [],
                homeoffice: entry.homeoffice,
                stunden: parseFloat(entry.stunden) || 0,
                entryCount: 1
            };
        } else if (
            current.datum === entry.datum &&
            current.ende === entry.start &&
            (current.projekte.includes('Pause') === (entry.projekt === 'Pause')) // Only merge if both are Pause or both are NOT Pause
        ) {
            // Nahtlos anschließend - zusammenfassen (egal welches Projekt)
            current.ende = entry.ende;
            current.stunden = calculateHours(current.start, current.ende);
            current.entryCount++;
            // Projekte sammeln
            if (entry.projekt && !current.projekte.includes(entry.projekt)) {
                current.projekte.push(entry.projekt);
            }
            // Tätigkeiten sammeln
            if (entry.taetigkeit && !current.taetigkeiten.includes(entry.taetigkeit)) {
                current.taetigkeiten.push(entry.taetigkeit);
            }
        } else {
            // Lücke - neuer Eintrag
            merged.push(current);
            current = {
                datum: entry.datum,
                start: entry.start,
                ende: entry.ende,
                projekte: [entry.projekt || 'Allgemein'],
                taetigkeiten: entry.taetigkeit ? [entry.taetigkeit] : [],
                homeoffice: entry.homeoffice,
                stunden: parseFloat(entry.stunden) || 0,
                entryCount: 1
            };
        }
    }

    // Letzten Eintrag hinzufügen
    if (current) {
        merged.push(current);
    }

    return merged;
}

export function exportXLSX() {
    const dataToExport = getExportEntries();

    dataToExport.sort((a, b) => {
        if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
        return (a.start || '').localeCompare(b.start || '');
    });

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
    XLSX.writeFile(wb, `Zeiterfassung_${getToday()}.xlsx`);
}

export function exportCSV() {
    const dataToExport = getExportEntries();

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
    link.download = `Zeiterfassung_${getToday()}.csv`;
    link.click();
}

export function exportJSON() {
    const dataToExport = getExportEntries();

    dataToExport.sort((a, b) => {
        if (a.datum !== b.datum) return a.datum.localeCompare(b.datum);
        return (a.start || '').localeCompare(b.start || '');
    });

    const jsonContent = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Zeiterfassung_${getToday()}.json`;
    link.click();
}

export function importJSON() {
    // Stub
    const input = document.getElementById('importFile');
    if (!input.files || !input.files[0]) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
                // Here we would need DB support to bulk insert
                // For now, let's just alert
                alert(`Backup enthält ${data.length} Einträge. Import ist in dieser Version noch nicht vollständig implementiert.`);
            }
        } catch (err) {
            alert('Fehler beim Lesen der JSON-Datei');
        }
    };
    reader.readAsText(input.files[0]);
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
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
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
