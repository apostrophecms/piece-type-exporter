export default () => {
  console.info('hai');
  // Allow Apostrophe to create the bus first
  setTimeout(function() {
    apos.bus && apos.bus.$on('export-download', (event) => {
      if (event.url) {
        window.open(event.url, '_blank');
      }
    });
  }, 0);
};
