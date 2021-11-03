const stringify = require('csv-stringify');
const fs = require('fs');

module.exports = {
  improve: '@apostrophecms/piece-type',
  batchOperations (self) {
    return {
      add: {
        export: {
          label: 'Export',
          route: '/export',
          messages: {
            progress: 'Exported {{ count }} {{ type }}.',
            completed: 'Exporting {{ type }}...'
          },
          requestOptions: {
            extension: 'csv'
          }
        }
      },
      group: {
        more: {
          icon: 'dots-vertical-icon',
          operations: [ 'export' ]
        }
      }
    };
  },
  init (self) {
    self.exportFormats = {
      csv: {
        label: 'CSV (comma-separated values)',
        output: function (filename) {
          const out = stringify({ header: true });
          out.pipe(fs.createWriteStream(filename));
          return out;
        }
      },
      tsv: {
        label: 'TSV (tab-separated values)',
        output: function (filename) {
          const out = stringify({
            header: true,
            delimiter: '\t'
          });
          out.pipe(fs.createWriteStream(filename));
          return out;
        }
      },
      xlsx: require('./lib/excel.js')(self),
      ...(self.options.exportFormats || {})
    };
  },
  methods (self) {
    return {
      ...require('./lib/export')(self)
    };
  },
  apiRoutes (self) {
    return {
      post: {
        export (req) {
          if (!Array.isArray(req.body._ids)) {
            throw self.apos.error('invalid');
          }
          // Reassigning this since it is referenced off of req elsewhere.
          req.body._ids = self.apos.launder.ids(req.body._ids);

          const extension = self.apos.launder.string(req.body.extension);
          const batchSize = self.apos.launder.integer(req.body.batchSize);
          const expiration = typeof self.options.export === 'object' ? self.apos.launder.integer(self.options.export.expiration) : null;

          if (!self.exportFormats[extension]) {
            throw self.apos.error('invalid');
          }

          // Add the piece type label to req.body for notifications.
          req.body.type = req.body._ids.length === 1 ? self.options.label : self.options.pluralLabel;

          const format = self.exportFormats[extension];

          return self.apos.modules['@apostrophecms/job'].runNonBatch(
            req,
            function (req, reporting) {
              return self.exportRun(req, reporting, {
                extension,
                format,
                batchSize,
                expiration
              });
            },
            {}
          );
        }
      }
    };
  }
};
