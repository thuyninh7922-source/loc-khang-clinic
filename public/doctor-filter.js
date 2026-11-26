(function () {
  // Lọc danh sách "Bác sĩ mong muốn" theo chuyên khoa đã chọn (trang đặt lịch và trang chủ).
  document.querySelectorAll('form').forEach(function (form) {
    var specialty = form.querySelector('select[name="specialty"]');
    var doctor = form.querySelector('select[name="doctor"]');
    if (!specialty || !doctor) return;
    var allOptions = Array.prototype.slice.call(doctor.options).map(function (opt) {
      return opt.cloneNode(true);
    });
    function apply() {
      var value = specialty.value;
      var previous = doctor.value;
      doctor.replaceChildren();
      allOptions.forEach(function (opt) {
        if (!opt.value || !value || opt.dataset.specialty === value) {
          doctor.appendChild(opt.cloneNode(true));
        }
      });
      var stillValid = Array.prototype.some.call(doctor.options, function (opt) {
        return opt.value === previous;
      });
      doctor.value = stillValid ? previous : '';
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
