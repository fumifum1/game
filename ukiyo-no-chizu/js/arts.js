// パズルの絵柄(すべてパブリックドメイン / Wikimedia Commons)
// url: 本番用(長辺1920px以下), thumb: メニュー用(330px)
(function () {
  const C = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';
  const U = 'https://upload.wikimedia.org/wikipedia/commons/';
  const commons = (hash, file, big) => ({
    url: big ? `${C}${hash}/${file}/1920px-${file}` : `${U}${hash}/${file}`,
    thumb: `${C}${hash}/${file}/330px-${file}`,
    source: `https://commons.wikimedia.org/wiki/File:${decodeURIComponent(file)}`,
  });

  window.UKIYOE_ARTS = [
    { id: 'wave', artist: '葛飾北斎', series: '冨嶽三十六景', title: '神奈川沖浪裏',
      ...commons('a/a5', 'Tsunami_by_hokusai_19th_century.jpg', true) },
    { id: 'redfuji', artist: '葛飾北斎', series: '冨嶽三十六景', title: '凱風快晴',
      ...commons('5/57', 'Red_Fuji_southern_wind_clear_morning.jpg', true) },
    { id: 'sanka', artist: '葛飾北斎', series: '冨嶽三十六景', title: '山下白雨',
      ...commons('7/75', 'Lightnings_below_the_summit.jpg', true) },
    { id: 'kajikazawa', artist: '葛飾北斎', series: '冨嶽三十六景', title: '甲州石班沢',
      ...commons('f/fc', 'Kajikazawa_in_Kai_province.jpg', true) },
    { id: 'ejiri', artist: '葛飾北斎', series: '冨嶽三十六景', title: '駿州江尻',
      ...commons('1/12', 'Ejiri_in_the_Suruga_province.jpg', true) },
    { id: 'naruto', artist: '歌川広重', series: '', title: '阿波鳴門之風景',
      ...commons('6/61', 'Utagawa_Hiroshige_%281857%29_Awa_Naruto_no_fuukei.jpg', true) },
    { id: 'shono', artist: '歌川広重', series: '東海道五十三次', title: '庄野 白雨',
      ...commons('f/f2', 'Hiroshige-53-Stations-Hoeido-46-Shono-Edo-Tokyo-M-01.jpg', false) },
    { id: 'atake', artist: '歌川広重', series: '名所江戸百景', title: '大はしあたけの夕立',
      ...commons('c/cc', 'Hiroshige_Atake_sous_une_averse_soudaine.jpg', false) },
    { id: 'kameido', artist: '歌川広重', series: '名所江戸百景', title: '亀戸梅屋舗',
      ...commons('d/db', 'Hiroshige_Pruneraie_%C3%A0_Kameido.jpg', false) },
  ];
})();
