(function () {
  // Lọc danh sách "Bác sĩ mong muốn" theo chuyên khoa đã chọn (trang đặt lịch và trang chủ).
  document.querySelectorAll('form').forEach(function (form) {
    var specialty = form.querySelector('select[name="specialty"]');
    var doctor = form.querySelector('select[name="doctor"]');
    if (!specialty || !doctor) return;
    var options = Array.prototype.slice.call(doctor.options);
    function apply() {
      var value = specialty.value;
      options.forEach(function (option) {
        if (!option.value) return;
        var show = !value || option.dataset.specialty === value;
        option.hidden = !show;
        option.disabled = !show;
      });
      var current = doctor.selectedOptions[0];
      if (current && current.disabled) doctor.value = '';
    }
    specialty.addEventListener('change', apply);
    apply();
  });

  // Trang "Đội ngũ": lọc thẻ bác sĩ theo chuyên khoa.
  var filter = document.querySelector('#doctor-specialty-filter');
  if (filter) {
    filter.addEventListener('change', function () {
      document.querySelectorAll('.profile-card[data-specialty]').forEach(function (card) {
        card.style.display = filter.value === 'all' || card.dataset.specialty === filter.value ? '' : 'none';
      });
    });
  }
})();
