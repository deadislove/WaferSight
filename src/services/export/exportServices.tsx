import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import fontUrl from '../../fonts/ChironGoRoundTC-VariableFont_wght.ttf'
import i18n from '../../i18n';

class ExportServices {
    constructor() { }

    private triggerDownload(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    private async loadFontAsBase64(url: string): Promise<string> {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = (reader.result as string).split(',')[1];
                resolve(base64data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
   * Exports as a CSV file.
   * @param data Array of objects to export
   * @param filename Download filename (default: export.csv)
   */
    public exportCSV<T extends Record<string, any>>(data: T[], filename: string = 'export.csv'): void {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);

        const csvRows: string[] = [];
        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header] ?? '';

                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        this.triggerDownload(blob, filename);
    }

    /**
     * Exports as an XML file.
     * @param data Array of objects to export
     * @param rootTag Root element name (default: root)
     * @param itemTag Per-record element name (default: item)
     * @param filename Download filename (default: export.xml)
     */
    public exportXML<T extends Record<string, any>>(
        data: T[],
        filename: string = 'export.xml',
        rootTag: string = 'records',
        itemTag: string = 'record'
    ): void {
        if (!data || data.length === 0) return;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n`;

        data.forEach((item) => {
            xml += `  <${itemTag}>\n`;
            Object.entries(item).forEach(([key, val]) => {

                const valueStr = val === null || val === undefined ? '' : String(val);
                const safeValue = valueStr
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                xml += `    <${key}>${safeValue}</${key}>\n`;
            });
            xml += `  </${itemTag}>\n`;
        });

        xml += `</${rootTag}>`;

        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
        this.triggerDownload(blob, filename);
    }

    /**
     * Exports as a PDF file.
     * @param data Array of objects to export
     * @param filename Download filename (default: export.pdf)
     * @param title Title shown at the top of the table
     */
    public async exportPDF<T extends Record<string, any>>(
        data: T[],
        filename: string = 'export.pdf',
        title: string = i18n.t('exportPdf.genericTitle')
    ): Promise<void> {
        if (!data || data.length === 0) return;

        const doc = new jsPDF({ orientation: 'landscape' });

        const fontBase64 = await this.loadFontAsBase64(fontUrl);
        doc.addFileToVFS('msjh-normal.ttf', fontBase64);
        doc.addFont('msjh-normal.ttf', 'msjh', 'normal');
        doc.setFont('msjh');

        const headers = Object.keys(data[0]);
        const body = data.map((row) => headers.map((header) => row[header] ?? ''));

        doc.setFontSize(16);
        doc.text(title, 14, 15);

        autoTable(doc, {
            startY: 20,
            head: [headers],
            body: body,
            styles: { fontSize: 9, cellPadding: 3, font: 'msjh' },
            headStyles: { fillColor: [30, 41, 59], font: 'msjh', fontStyle: 'normal' },
        });

        // Save the file
        doc.save(filename);
    }

    /**
     * Exports the AI defect detection report (multi-section PDF: model
     * info + all wafer classification results + defect pattern distribution).
     */
    public async exportDefectDetectionReport(params: {
        filename?: string;
        generatedAt: string;
        modelInfo: { datasetName: string; numClasses: number; testAccuracy: number };
        waferResults: {
            lotNumber: string;
            waferNumber: number;
            product: string;
            yieldPct: number;
            predictedPattern: string;
            confidencePct: number;
        }[];
        paretoData: { label: string; count: number }[];
        simulationRuns?: {
            params: Record<string, number>;
            predictedPattern: string;
            confidencePct: number;
        }[];
    }): Promise<void> {
        const { filename = 'ai-defect-detection-report.pdf', generatedAt, modelInfo, waferResults, paretoData, simulationRuns } = params;

        const doc = new jsPDF({ orientation: 'portrait' });

        const fontBase64 = await this.loadFontAsBase64(fontUrl);
        doc.addFileToVFS('msjh-normal.ttf', fontBase64);
        doc.addFont('msjh-normal.ttf', 'msjh', 'normal');
        doc.setFont('msjh');

        const tt = i18n.t.bind(i18n);

        let y = 18;
        doc.setFontSize(18);
        doc.setTextColor(20);
        doc.text(tt('exportPdf.defectReportTitle'), 14, y);
        y += 7;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`${tt('exportPdf.generatedAt')}: ${generatedAt}`, 14, y);
        y += 10;

        doc.setFontSize(12);
        doc.setTextColor(20);
        doc.text(tt('exportPdf.modelInfoTitle'), 14, y);
        y += 6;
        doc.setFontSize(9);
        doc.setTextColor(60);
        const modelLines = [
            tt('exportPdf.modelTypeLine'),
            `${tt('exportPdf.trainingDataLine')}: ${modelInfo.datasetName} (${tt('exportPdf.publicDatasetNote')})`,
            `${tt('exportPdf.numClassesLine')}: ${modelInfo.numClasses}`,
            `${tt('exportPdf.testAccuracyLine')}: ${(modelInfo.testAccuracy * 100).toFixed(1)}%`,
            tt('exportPdf.inferenceMethodLine'),
        ];
        modelLines.forEach((line) => {
            doc.text(line, 14, y);
            y += 5;
        });
        y += 5;

        let afterParetoY = y;

        if (waferResults.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(20);
            doc.text(tt('exportPdf.waferResultsTitle'), 14, y);

            autoTable(doc, {
                startY: y + 4,
                head: [[tt('exportPdf.colLot'), tt('exportPdf.colWafer'), tt('exportPdf.colProduct'), tt('exportPdf.colYield'), tt('exportPdf.colPattern'), tt('exportPdf.colConfidence')]],
                body: waferResults.map((r) => [
                    r.lotNumber,
                    `#${r.waferNumber}`,
                    r.product,
                    `${r.yieldPct.toFixed(1)}%`,
                    r.predictedPattern,
                    `${r.confidencePct.toFixed(1)}%`,
                ]),
                styles: { fontSize: 9, cellPadding: 3, font: 'msjh' },
                headStyles: { fillColor: [30, 41, 59], font: 'msjh', fontStyle: 'normal' },
            });

            const afterTableY = (doc as any).lastAutoTable.finalY + 10;

            doc.setFontSize(12);
            doc.setTextColor(20);
            doc.text(tt('exportPdf.paretoTitle'), 14, afterTableY);

            autoTable(doc, {
                startY: afterTableY + 4,
                head: [[tt('exportPdf.colPatternType'), tt('exportPdf.colWaferCount')]],
                body: paretoData.map((p) => [p.label, String(p.count)]),
                styles: { fontSize: 9, cellPadding: 3, font: 'msjh' },
                headStyles: { fillColor: [30, 41, 59], font: 'msjh', fontStyle: 'normal' },
            });

            afterParetoY = (doc as any).lastAutoTable.finalY + 10;
        }

        if (simulationRuns && simulationRuns.length > 0) {

            doc.setFontSize(12);
            doc.setTextColor(20);
            doc.text(tt('exportPdf.simulationTitle'), 14, afterParetoY);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(tt('exportPdf.simulationDisclaimer'), 14, afterParetoY + 5);

            autoTable(doc, {
                startY: afterParetoY + 9,
                head: [[tt('exportPdf.colEdgeContamination'), tt('exportPdf.colCenterTempDeviation'), tt('exportPdf.colMechanicalStress'), tt('exportPdf.colLocalYieldVariance'), tt('exportPdf.colBaselineDefectRate'), tt('exportPdf.colPredictedPattern'), tt('exportPdf.colConfidence')]],
                body: simulationRuns.map((r) => [
                    `${(r.params.edgeContamination * 100).toFixed(0)}%`,
                    `${(r.params.centerTempDeviation * 100).toFixed(0)}%`,
                    `${(r.params.mechanicalStress * 100).toFixed(0)}%`,
                    `${(r.params.localYieldVariance * 100).toFixed(0)}%`,
                    `${(r.params.baselineDefectRate * 100).toFixed(0)}%`,
                    r.predictedPattern,
                    `${r.confidencePct.toFixed(1)}%`,
                ]),
                styles: { fontSize: 8, cellPadding: 2.5, font: 'msjh' },
                headStyles: { fillColor: [30, 41, 59], font: 'msjh', fontStyle: 'normal' },
            });
        }

        doc.save(filename);
    }
}

export const exportServices = new ExportServices();