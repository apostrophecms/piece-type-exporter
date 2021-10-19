// http://talesofthefluxfox.com/2016/10/07/writing-to-xlsx-spreadsheets-in-node-js/

const ALPHA = [ 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

const XLSX = require('xlsx');

function objectsToWorkbook (objects, selectedFields, spreadsheetName) {
  const rowsOfData = objects;
  let lineNum = 1;
  const worksheetColumns = [];

  selectedFields.forEach(function () {
    worksheetColumns.push({
      wch: 25
    });
  });

  const workbook = {
    SheetNames: [ spreadsheetName ],
    Sheets: {
      [spreadsheetName]:
      {
        '!ref': 'A1:',
        '!cols': worksheetColumns
      }
    }
  };

  for (let i = 0; i < selectedFields.length; i++) {
    worksheetColumns.push(
      {
        wch: 25
      });
    const currentCell = _calculateCurrentCellReference(i, lineNum);
    workbook.Sheets[spreadsheetName][currentCell] = {
      t: 's',
      v: selectedFields[i],
      s: {
        font:
        {
          bold: true
        }
      }
    };
  }
  lineNum++;
  rowsOfData.forEach(function (offer) {
    for (let i = 0; i < selectedFields.length; i++) {
      const displayValue = offer[selectedFields[i]];
      const currentCell = _calculateCurrentCellReference(i, lineNum);
      workbook.Sheets[spreadsheetName][currentCell] = {
        t: 's',
        v: displayValue,
        s: {
          font: {
            sz: '11',
            bold: false
          },
          alignment: {
            wrapText: true,
            vertical: 'top'
          },
          fill: {
            fgColor: {
              rgb: 'ffffff'
            }
          },
          border: {
            left: {
              style: 'thin',
              color: {
                auto: 1
              }
            },
            right:
            {
              style: 'thin',
              color: {
                auto: 1
              }
            },
            top:
            {
              style: 'thin',
              color: {
                auto: 1
              }
            },
            bottom:
            {
              style: 'thin',
              color: {
                auto: 1
              }
            }
          }
        }
      };
    }
    lineNum++;
  });
  const lastColumnInSheet = selectedFields.length - 1;
  const endOfRange = _calculateCurrentCellReference(lastColumnInSheet, lineNum);
  workbook.Sheets[spreadsheetName]['!ref'] += endOfRange;
  return workbook;
}

function _calculateCurrentCellReference (index, lineNumber) {
  return (index > 25) ? ALPHA[Math.floor((index / 26) - 1)] + ALPHA[index % 26] + lineNumber : ALPHA[index] + lineNumber;
}

module.exports = function (self) {
  return {
    label: 'Excel (.xlsx)',
    output: function (filename, objects, callback) {
      try {
        const fields = self.schema.map(self.schema, field => field.name);
        const label = self.pluralLabel || self.label || self.__meta.name;
        const workbook = objectsToWorkbook(objects, fields, label);

        XLSX.writeFile(workbook, filename);
      } catch (e) {
        return callback(e);
      }
      return setImmediate(callback);
    }
  };
};
