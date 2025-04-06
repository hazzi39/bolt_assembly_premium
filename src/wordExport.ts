import { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, BorderStyle, Packer } from 'docx';
import { saveAs } from 'file-saver';

interface WordExportData {
  inputs: {
    numRows: number;
    numCols: number;
    rowSpacing: number;
    colSpacing: number;
    vx: number;
    vy: number;
    tb: number;
    mb: number;
    mm: number;
    nt: number;
    boltGrade: string;
    boltSize: string;
    pryingAllowance: number;
  };
  results: {
    shearForce: number;
    axialForce: number;
    combinedRatio: number;
    maxShear: number;
    maxTension: number;
    tensileArea: number;
    ibp: number;
    shearStress: number;
    tensileStress: number;
  };
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const generateWordDocument = async (data: WordExportData) => {
  try {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: "Bolt Group Analysis Calculation Report",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // Date
          new Paragraph({
            children: [
              new TextRun({
                text: `Date: ${formatDate(new Date())}`,
                size: 24
              })
            ],
            spacing: { after: 400 }
          }),

          // Input Parameters Section
          new Paragraph({
            text: "1. Input Parameters",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          // Bolt Layout Table
          new Table({
            width: {
              size: 100,
              type: "pct"
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Parameter")] }),
                  new TableCell({ children: [new Paragraph("Value")] }),
                  new TableCell({ children: [new Paragraph("Units")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Number of Rows")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.numRows.toString())] }),
                  new TableCell({ children: [new Paragraph("-")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Number of Columns")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.numCols.toString())] }),
                  new TableCell({ children: [new Paragraph("-")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Row Spacing")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.rowSpacing.toString())] }),
                  new TableCell({ children: [new Paragraph("mm")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Column Spacing")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.colSpacing.toString())] }),
                  new TableCell({ children: [new Paragraph("mm")] })
                ]
              })
            ]
          }),

          // Applied Loads Section
          new Paragraph({
            text: "2. Applied Loads",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Table({
            width: { size: 100, type: "pct" },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Load Type")] }),
                  new TableCell({ children: [new Paragraph("Value")] }),
                  new TableCell({ children: [new Paragraph("Units")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Horizontal Shear (Vx)")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.vx.toString())] }),
                  new TableCell({ children: [new Paragraph("kN")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Vertical Shear (Vy)")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.vy.toString())] }),
                  new TableCell({ children: [new Paragraph("kN")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Torsion (Tb)")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.tb.toString())] }),
                  new TableCell({ children: [new Paragraph("kNm")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Major Axis Moment (Mb)")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.mb.toString())] }),
                  new TableCell({ children: [new Paragraph("kNm")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Minor Axis Moment (Mm)")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.mm.toString())] }),
                  new TableCell({ children: [new Paragraph("kNm")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Axial Force (Nt)")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.nt.toString())] }),
                  new TableCell({ children: [new Paragraph("kN")] })
                ]
              })
            ]
          }),

          // Bolt Properties Section
          new Paragraph({
            text: "3. Bolt Properties",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Table({
            width: { size: 100, type: "pct" },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Property")] }),
                  new TableCell({ children: [new Paragraph("Value")] }),
                  new TableCell({ children: [new Paragraph("Units")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Bolt Grade")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.boltGrade)] }),
                  new TableCell({ children: [new Paragraph("-")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Bolt Size")] }),
                  new TableCell({ children: [new Paragraph(data.inputs.boltSize)] }),
                  new TableCell({ children: [new Paragraph("-")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Tensile Area")] }),
                  new TableCell({ children: [new Paragraph(data.results.tensileArea.toFixed(1))] }),
                  new TableCell({ children: [new Paragraph("mm²")] })
                ]
              })
            ]
          }),

          // Results Section
          new Paragraph({
            text: "4. Analysis Results",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Table({
            width: { size: 100, type: "pct" },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
              insideVertical: { style: BorderStyle.SINGLE, size: 1 }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Result")] }),
                  new TableCell({ children: [new Paragraph("Value")] }),
                  new TableCell({ children: [new Paragraph("Units")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Maximum Shear Force")] }),
                  new TableCell({ children: [new Paragraph(data.results.shearForce.toFixed(2))] }),
                  new TableCell({ children: [new Paragraph("kN")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Maximum Tensile Force")] }),
                  new TableCell({ children: [new Paragraph(data.results.axialForce.toFixed(2))] }),
                  new TableCell({ children: [new Paragraph("kN")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Maximum Shear Stress")] }),
                  new TableCell({ children: [new Paragraph(data.results.shearStress.toFixed(1))] }),
                  new TableCell({ children: [new Paragraph("MPa")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Maximum Tensile Stress")] }),
                  new TableCell({ children: [new Paragraph(data.results.tensileStress.toFixed(1))] }),
                  new TableCell({ children: [new Paragraph("MPa")] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Combined Ratio")] }),
                  new TableCell({ children: [new Paragraph(data.results.combinedRatio.toFixed(3))] }),
                  new TableCell({ children: [new Paragraph("-")] })
                ]
              })
            ]
          }),

          // Conclusion
          new Paragraph({
            text: "5. Conclusion",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `The bolt group analysis ${data.results.combinedRatio <= 1 ? 'satisfies' : 'does not satisfy'} the combined shear and tension requirements. `,
                size: 24
              }),
              new TextRun({
                text: `The combined utilisation ratio is ${data.results.combinedRatio.toFixed(3)}, which is ${data.results.combinedRatio <= 1 ? 'less than' : 'greater than'} the allowable value of 1.0.`,
                size: 24
              })
            ],
            spacing: { after: 200 }
          }),

          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: "Generated by DummyMember.com Bolt Group Analysis Calculator",
                size: 20,
                italics: true
              })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 }
          })
        ]
      }]
    });

    // Generate and save the document using Packer.toBlob instead of toBuffer
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `bolt-group-analysis_${formatDate(new Date())}.docx`);
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw error;
  }
};