(function () {
  var params = new URLSearchParams(window.location.search);

  function setupForm(form, catalog) {
    var specialty = form.querySelector('select[name="specialty"]');
    var doctor = form.querySelector('select[name="doctor"]');
    if (!specialty || !doctor) return;

    var disease = form.querySelector('select[name="disease"]');
    var tierRadios = Array.prototype.slice.call(form.querySelectorAll('input[name="serviceTier"]'));
    var note = form.querySelector('textarea[name="note"]');
    var doctors = catalog.doctors || [];
    var diseases = catalog.diseases || [];
    var doctorByName = new Map(doctors.map(function (d) { return [d.name, d]; }));
    var diseaseByName = new Map(diseases.map(function (d) { return [d.name, d]; }));

    function currentTier() {
      if (!tierRadios.length) return '';
      var checked = tierRadios.find(function (r) { return r.checked; });
      return checked ? checked.value : 'standard';
    }

    function renderDiseases(selectedSpecialty, keepValue) {
      if (!disease) return;
      var previous = keepValue !== undefined ? keepValue : disease.value;
      disease.replaceChildren(new Option('— Chọn bệnh lý (hoặc tự chọn chuyên khoa / bác sĩ bên dưới) —', ''));
      var filtered = selectedSpecialty
        ? diseases.filter(function (item) { return item.specialty === selectedSpecialty; })
        : diseases;
      filtered.forEach(function (item) {
        var label = selectedSpecialty ? item.name : item.name + ' (' + item.specialty + ')';
        var opt = new Option(label, item.name);
        opt.dataset.specialty = item.specialty;
        disease.appendChild(opt);
      });
      var valid = Array.prototype.some.call(disease.options, function (opt) { return opt.value === previous; });
      disease.value = valid ? previous : '';
    }

    function renderDoctors(selectedSpecialty, keepValue) {
      var tier = currentTier();
      var previous = keepValue !== undefined ? keepValue : doctor.value;
      var placeholder = tier === 'premium'
        ? 'Chọn GS / PGS.TS / TS.BS phụ trách'
        : tier === 'standard'
          ? 'Chọn Bác sĩ chuyên khoa'
          : 'Chọn bác sĩ';
      doctor.replaceChildren(new Option(placeholder, ''));

      var filtered = doctors.filter(function (item) {
        var matchSpec = !selectedSpecialty || item.specialty === selectedSpecialty;
        var matchTier = !tier || item.tier === tier;
        return matchSpec && matchTier;
      });

      filtered.forEach(function (item) {
        var suffix = selectedSpecialty ? '' : ' · ' + item.specialty;
        var opt = new Option(item.name + suffix, item.name);
        opt.dataset.specialty = item.specialty;
        opt.dataset.tier = item.tier;
        doctor.appendChild(opt);
      });

      var valid = Array.prototype.some.call(doctor.options, function (opt) { return opt.value === previous; });
      if (valid) {
        doctor.value = previous;
      } else if (selectedSpecialty && filtered.length === 1) {
        // Nếu chuyên khoa và hạng dịch vụ chỉ có 1 bác sĩ phù hợp thì chọn sẵn luôn
        doctor.value = filtered[0].name;
      } else {
        doctor.value = '';
      }
    }

    // 1. Khi chọn Bệnh lý -> tự động chọn Chuyên khoa, lọc Bác sĩ & gợi ý vào ghi chú
    if (disease) {
      disease.addEventListener('change', function () {
        var picked = diseaseByName.get(disease.value);
        if (!picked) return;
        if (specialty.value !== picked.specialty) {
          specialty.value = picked.specialty;
          specialty.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          renderDoctors(picked.specialty);
        }
        if (note && (!note.value.trim() || note.dataset.autoDisease === '1')) {
          note.value = 'Nhu cầu khám: ' + picked.name;
          note.dataset.autoDisease = '1';
        }
      });
      if (note) {
        note.addEventListener('input', function () { delete note.dataset.autoDisease; });
      }
    }

    // 2. Khi chọn Chuyên khoa -> lọc Bác sĩ theo chuyên khoa & hạng dịch vụ, lọc Bệnh lý
    specialty.addEventListener('change', function () {
      renderDoctors(specialty.value);
      renderDiseases(specialty.value);
    });

    // 3. Khi chọn Bác sĩ trước -> tự động chọn đúng Chuyên khoa và Hạng dịch vụ
    doctor.addEventListener('change', function () {
      var info = doctorByName.get(doctor.value);
      if (!info) return;
      if (tierRadios.length && currentTier() !== info.tier) {
        var targetRadio = tierRadios.find(function (r) { return r.value === info.tier; });
        if (targetRadio) {
          targetRadio.checked = true;
          targetRadio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (specialty.value !== info.specialty) {
        specialty.value = info.specialty;
        specialty.dispatchEvent(new Event('change', { bubbles: true }));
        doctor.value = info.name;
      }
    });

    // 4. Khi đổi Hạng dịch vụ (Thường <-> Cao cấp) -> lọc lại Bác sĩ & phát sự kiện đổi giá
    tierRadios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        renderDoctors(specialty.value, '');
        form.dispatchEvent(new CustomEvent('tierchange', { detail: { tier: currentTier() } }));
      });
    });

    // Khởi tạo danh sách & áp dụng tham số URL (từ trang /diseases hoặc /doctors)
    var initTier = params.get('tier');
    if (initTier && tierRadios.length) {
      var radio = tierRadios.find(function (r) { return r.value === initTier; });
      if (radio) radio.checked = true;
    }
    var initDisease = params.get('disease') || '';
    var initDoctor = params.get('doctor') || '';
    var initSpecialty = params.get('specialty')
      || (diseaseByName.get(initDisease) && diseaseByName.get(initDisease).specialty)
      || (doctorByName.get(initDoctor) && doctorByName.get(initDoctor).specialty)
      || specialty.value;

    renderDiseases('', initDisease);
    if (initSpecialty) {
      specialty.value = initSpecialty;
      renderDiseases(initSpecialty, initDisease);
    }
    renderDoctors(specialty.value, initDoctor);
    if (initDisease && note && !note.value.trim()) {
      note.value = 'Nhu cầu khám: ' + initDisease;
      note.dataset.autoDisease = '1';
    }
    if (initSpecialty) {
      specialty.dispatchEvent(new Event('change', { bubbles: true }));
      if (initDoctor && doctorByName.get(initDoctor)) doctor.value = initDoctor;
      if (initDisease && disease) disease.value = initDisease;
    }
    form.dispatchEvent(new CustomEvent('tierchange', { detail: { tier: currentTier() } }));
  }

  // Nạp danh mục bác sĩ & bệnh lý từ server cho các form đặt lịch
  var forms = document.querySelectorAll('form');
  var hasBookingSelect = Array.prototype.some.call(forms, function (f) {
    return f.querySelector('select[name="specialty"]') && f.querySelector('select[name="doctor"]');
  });
  if (hasBookingSelect) {
    fetch('/api/doctors', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error('API error')); })
      .then(function (catalog) {
        forms.forEach(function (form) { setupForm(form, catalog); });
      })
      .catch(function () {
        // Fallback giữ nguyên danh sách tĩnh nếu không gọi được API
      });
  }

  // Trang "Đội ngũ": lọc thẻ bác sĩ theo chuyên khoa
  var filter = document.querySelector('#doctor-specialty-filter');
  if (filter) {
    filter.addEventListener('change', function () {
      document.querySelectorAll('.profile-card[data-specialty]').forEach(function (card) {
        card.style.display = filter.value === 'all' || card.dataset.specialty === filter.value ? '' : 'none';
      });
    });
  }
})();
