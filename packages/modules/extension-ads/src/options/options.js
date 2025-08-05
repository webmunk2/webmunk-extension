import $ from 'jquery'
$(document).ready(function() {
  $('#saveBtn').click(function() {
      const highlightAds = $('#highlightAds').is(':checked');
      const option2 = $('#option2').is(':checked');

      // Save the options - assuming you're using chrome.storage API
      chrome.storage.sync.set({ highlightAds, option2 }, function() {
          console.log('Options saved.');
          // Implement any feedback you want to give to the user here
      });
  });

  // Load the options - assuming you're using chrome.storage API
  chrome.storage.sync.get(['highlightAds', 'option2'], function(items) {
      $('#highlightAds').prop('checked', items.highlightAds);
      $('#option2').prop('checked', items.option2);
  });
});
