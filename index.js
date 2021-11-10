const stringify = require('csv-stringify');
const fs = require('fs');

module.exports = {
  improve: '@apostrophecms/piece-type',
  batchOperations (self) {
    if (!self.options.export) {
      return {};
    }

    return {
      add: {
        export: {
          label: 'Export',
          route: '/export',
          messages: {
            progress: 'Exporting {{ type }}...'
          },
          requestOptions: {
            extension: 'csv'
          },
          modalOptions: {
            title: 'Export {{ type }}',
            description: 'Are you sure you want to export {{ count }} {{ type }}',
            confirmationButton: 'Yes, export content'
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
    if (!self.options.export) {
      return;
    }

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
    if (!self.options.export) {
      return {};
    }

    return {
      ...require('./lib/export')(self)
    };
  },
  apiRoutes (self) {
    if (!self.options.export) {
      return {};
    }

    return {
      post: {
        export (req) {
          if (!Array.isArray(req.body._ids)) {
            throw self.apos.error('invalid');
          }
          // Reassigning this since it is referenced off of req elsewhere.
          req.body._ids = self.apos.launder.ids(req.body._ids);

          const extension = self.apos.launder.string(req.body.extension);
          const batchSize = typeof self.options.export === 'object' &&
            self.apos.launder.integer(self.options.export.batchSize);
          const expiration = typeof self.options.export === 'object' &&
            self.apos.launder.integer(self.options.export.expiration);

          if (!self.exportFormats[extension]) {
            throw self.apos.error('invalid');
          }

          // Add the piece type label to req.body for notifications.
          req.body.type = req.body._ids.length === 1 ? self.options.label : self.options.pluralLabel;

          const format = self.exportFormats[extension];

          return self.apos.modules['@apostrophecms/job'].run(
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
