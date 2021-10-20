const fs = require('fs');
const path = require('path');

module.exports = (self) => {
  return {
    cleanup(file) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        self.apos.util.error(e);
      }
    },
    writeBatch,
    exportRun,
    exportRecord,
    close,
    beforeExport (req, piece, record) {
      return record;
    }
  };

  async function writeBatch (req, out, lastId = '', reporting, options) {
    let batch;
    try {
      batch = await self.find(req)
        .archived(options.archived)
        .sort({ _id: 1 }).and({ _id: { $gt: lastId } })
        .limit(options.batchSize || 100)
        .applyBuildersSafely(options.filters || {}, 'manage').toArray();
    } catch (error) {
      // TODO: Probably deliver the error value differently.
      throw self.apos.error('error', error);
    }

    if (!batch.length) {
      return self.close(out);
    }

    lastId = batch[batch.length - 1]._id;

    for (const piece of batch) {
      try {
        const record = await self.exportRecord(req, piece);

        reporting.good();
        out.write(record);
      } catch (error) {
        console.error('exportRecord error', piece._id, error);
        reporting.bad();
      }
    }

    return self.writeBatch(req, out, lastId, reporting, options);
  }

  function close(stream) {
    stream.end();
  }

  async function exportRun (req, reporting, options) {
    const draftOrLive = options.draftOrLive;
    const archived = options.archived === 'both' || options.archived === '' ? null : options.archived === 'yes';
    const extension = options.extension;
    const format = options.format;

    const filename = `${self.apos.util.generateId()}-export.${extension}`;
    const filepath = path.join(self.apos.attachment.uploadfs.getTempPath(), filename);

    let out;
    let data;
    let reported = false;

    if (draftOrLive === 'live') {
      // Hack to fetch the live docs
      // TODO: Switch mode in the A3 way
      req.locale = req.locale.replace(/-draft$/, '');
    }

    if (format.output.length === 1) {
      // Now kick off the stream processing
      out = format.output(filepath);
    } else {
      // Create a simple writable stream that just buffers up the objects. Allows the simpler type of output function to drive the same methods that otherwise write to an output stream.
      data = [];
      out = {
        write: function (o) {
          data.push(o);
        },
        end: function () {
          return format.output(filepath, data, function (err) {
            if (err) {
              out.emit('error', err);
            } else {
              out.emit('finish');
            }
          });
        },
        on: function (name, fn) {
          out.listeners[name] = out.listeners[name] || [];
          out.listeners[name].push(fn);
        },
        emit: function (name, value) {
          (out.listeners[name] || []).forEach(function (fn) {
            fn(value);
          });
        },
        listeners: {}
      };
    }

    const result = new Promise((resolve, reject) => {
      out.on('error', function (err) {
        if (!reported) {
          reported = true;
          self.cleanup(filepath);
          // TODO: Probably deliver the error value differently.
          return reject(self.apos.error('error', err));
        }
      });

      out.on('finish', async function () {
        if (!reported) {
          reported = true;
          // Must copy it to uploadfs, the server that created it
          // and the server that delivers it might be different
          const filename = `${self.apos.util.generateId()}.${extension}`;
          const downloadPath = path.join('/exports', filename);

          const copyIn = require('util').promisify(self.apos.attachment.uploadfs.copyIn);

          try {
            await copyIn(filepath, downloadPath);
          } catch (error) {
            self.cleanup(filepath);
            return reject(error);
          }

          reporting.setResults({
            url: path.join(self.apos.attachment.uploadfs.getUrl(), downloadPath)
          });

          self.cleanup(filepath);

          // Report is available for one hour
          setTimeout(function () {
            self.apos.attachment.uploadfs.remove(downloadPath, function (err) {
              if (err) {
                self.apos.util.error(err);
              }
            });
          }, options.expiration || 1000 * 60 * 60);

          return resolve(null);
        }
      });

    });

    await self.writeBatch(req, out, '', reporting, {
      ...options,
      archived
    });

    return result;
  };

  async function exportRecord (req, piece) {
    const schema = self.schema;
    const record = {};
    // Schemas don't have built-in exporters, for strings or otherwise.
    // Follow a format that reverses well if fed back to our importer
    // (although the importer can't accept an attachment via URL yet,
    // that is a plausible upgrade). Export schema fields only,
    // plus _id.
    record._id = piece._id;

    schema.forEach(function (field) {
      if (self.options.export.omitFields && self.options.export.omitFields.includes(field.name)) {
        return;
      }
      let value = piece[field.name];
      if ((typeof value) === 'object') {
        if (field.type === 'relationship') {
          value = (value || []).map(function (item) {
            return item.title;
          }).join(',');
        } else if (field.type === 'attachment') {
          value = self.apos.attachment.url(value);
        } else if ((field.type === 'area')) {
          if (field?.options?.exportPlainText) {
            value = self.apos.area.plaintext(value);
          } else {
            value = self.apos.area.richText(value);
          }
        } else {
          value = '';
        }
      } else {
        if (value) {
          value = value.toString();
        }
      }
      record[field.name] = value;
    });

    await self.beforeExport(req, piece, record);

    return record;
  };
};
