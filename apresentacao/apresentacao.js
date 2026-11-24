(function () {
  var root = document.documentElement;
  var els = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) { root.classList.add('nojs'); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  els.forEach(function (el) { io.observe(el); });

  var dots = document.querySelectorAll('.dots a');
  var scenes = document.querySelectorAll('.scene');
  var so = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) {
        dots.forEach(function (d) { d.classList.toggle('on', d.getAttribute('href') === '#' + e.target.id); });
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  scenes.forEach(function (s) { so.observe(s); });

  var bar = document.querySelector('.progress');
  function prog() {
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (h > 0 ? scrollY / h * 100 : 0) + '%';
  }
  addEventListener('scroll', prog, { passive: true }); prog();
})();
