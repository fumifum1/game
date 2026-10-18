// 世界の大陸パズルの絵柄(すべてパブリックドメイン / Wikimedia Commons)
// 作者の没後70年以上たった作品のみ。並び順 = 解放される順番
(function () {
  const C = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';
  const U = 'https://upload.wikimedia.org/wikipedia/commons/';
  // big=true: 原寸が大きいので1920px版を使う / false: 原寸を使う
  const commons = (hash, file, big) => ({
    url: big ? `${C}${hash}/${file}/1920px-${file}` : `${U}${hash}/${file}`,
    thumb: `${C}${hash}/${file}/330px-${file}`,
    source: `https://commons.wikimedia.org/wiki/File:${decodeURIComponent(file)}`,
  });

  window.WORLD_ARTS = {
    europe: [
      { id: 'starrynight', artist: 'ゴッホ', series: '1889年', title: '星月夜', ...commons('e/ea', 'Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg', true) },
      { id: 'impression', artist: 'モネ', series: '1872年', title: '印象・日の出', ...commons('5/59', 'Monet_-_Impression%2C_Sunrise.jpg', true) },
      { id: 'hunters', artist: 'ブリューゲル', series: '1565年', title: '雪中の狩人', ...commons('d/d8', 'Pieter_Bruegel_the_Elder_-_Hunters_in_the_Snow_%28Winter%29_-_Google_Art_Project.jpg', true) },
      { id: 'kiss', artist: 'クリムト', series: '1908年', title: '接吻', ...commons('4/40', 'The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg', true) },
      { id: 'wanderer', artist: 'フリードリヒ', series: '1818年', title: '雲海の上の旅人', ...commons('a/af', 'Caspar_David_Friedrich_-_Wanderer_above_the_Sea_of_Fog.jpeg', true) },
    ],
    asia: [
      { id: 'inwang', artist: '鄭敾（朝鮮）', series: '1751年', title: '仁王霽色図', ...commons('a/a7', 'Inwangjesaekdo.jpg', true) },
      { id: 'fankuan', artist: '范寛（北宋）', series: '11世紀', title: '谿山行旅図', ...commons('c/c2', 'Fan_Kuan_-_Travelers_Among_Mountains_and_Streams_-_Google_Art_Project.jpg', true) },
      { id: 'gayumars', artist: 'スルターン・ムハンマド（ペルシア）', series: '16世紀', title: 'ガユーマルスの宮廷', ...commons('e/ec', 'The_Court_of_Gayumars.jpg', true) },
      { id: 'ssireum', artist: '金弘道（朝鮮）', series: '18世紀', title: '相撲（シルム）', ...commons('e/ef', 'Danwon_Ssireum.jpg', true) },
    ],
    africa: [
      { id: 'nefertari', artist: '古代エジプトの画工', series: '紀元前13世紀', title: 'ネフェルタリ王妃の墓の壁画', ...commons('b/b4', 'Maler_der_Grabkammer_der_Nefertari_003.jpg', true) },
      { id: 'ethiopia', artist: 'エチオピアの画家', series: '17世紀頃', title: '聖ゲオルギオスと聖母子', ...commons('7/7e', 'Ethiopian_-_Diptych_Icon_with_Saint_George%2C_and_Mary_and_the_Infant_Christ_-_Walters_3616_-_Open.jpg', false) },
      { id: 'nebamun', artist: '古代エジプトの画工', series: '紀元前14世紀', title: 'ネバムンの狩猟', ...commons('b/bd', 'Tomb_of_Nebamun.jpg', true) },
      { id: 'garden', artist: '古代エジプトの画工', series: '紀元前14世紀', title: 'ネバムンの庭園', ...commons('4/4b', 'Le_Jardin_de_N%C3%A9bamoun.jpg', true) },
    ],
    northamerica: [
      { id: 'sierra', artist: 'ビアスタット', series: '1868年', title: 'シエラネバダ山脈にて', ...commons('5/5c', 'Albert_Bierstadt_-_Among_the_Sierra_Nevada%2C_California_-_Google_Art_Project.jpg', true) },
      { id: 'breezing', artist: 'ホーマー', series: '1876年', title: '順風', ...commons('9/96', 'Winslow_Homer_-_Breezing_Up_%28A_Fair_Wind%29_-_Google_Art_Project.jpg', true) },
      { id: 'oxbow', artist: 'トマス・コール', series: '1836年', title: 'オックスボウ', ...commons('b/b1', 'Cole_Thomas_The_Oxbow_%28The_Connecticut_River_near_Northampton_1836%29.jpg', true) },
      { id: 'mexico', artist: 'ベラスコ（メキシコ）', series: '1875年', title: 'メキシコ盆地', ...commons('e/e2', 'Jos%C3%A9_Mar%C3%ADa_Velasco_-_The_Valley_of_Mexico_from_the_Santa_Isabel_Mountain_Range_-_Google_Art_Project.jpg', true) },
    ],
    southamerica: [
      { id: 'altocampo', artist: 'プエイレドン（アルゼンチン）', series: '1861年', title: '野での休息', ...commons('e/ed', 'Prilidiano_Pueyrredon_-_Un_alto_en_el_campo_-_Google_Art_Project.jpg', true) },
      { id: 'independencia', artist: 'ペドロ・アメリコ（ブラジル）', series: '1888年', title: '独立か死か', ...commons('7/7e', 'Pedro_Am%C3%A9rico_-_Independ%C3%AAncia_ou_Morte_-_Google_Art_Project.jpg', true) },
      { id: 'caipira', artist: 'アルメイダ・ジュニオル（ブラジル）', series: '1893年', title: 'たばこを刻む農夫', ...commons('6/6e', 'Almeida_J%C3%BAnior_-_Caipira_Cutting_Tobacco_-_Google_Art_Project.jpg', true) },
      { id: 'juramento', artist: 'ブラネス（ウルグアイ）', series: '1877年', title: '三十三人の東方人の誓い', ...commons('d/d0', 'Juan_Manuel_Blanes_-_El_Juramento_de_los_Treinta_y_Tres_Orientales.jpg', true) },
    ],
    oceania: [
      { id: 'goldensummer', artist: 'ストリートン', series: '1889年', title: '黄金の夏', ...commons('4/4c', 'Arthur_Streeton_-_Golden_summer%2C_Eaglemont_-_Google_Art_Project.jpg', true) },
      { id: 'shearing', artist: 'トム・ロバーツ', series: '1890年', title: '羊の毛刈り', ...commons('9/91', 'Tom_Roberts_-_Shearing_the_rams_-_Google_Art_Project.jpg', true) },
      { id: 'sydneyheads', artist: 'フォン・ゲラール', series: '1865年', title: 'シドニー・ヘッズ', ...commons('c/c3', 'Eugene_von_Gu%C3%A9rard_-_Sydney_Heads_-_Google_Art_Project.jpg', true) },
      { id: 'downluck', artist: 'マッカビン', series: '1889年', title: '不運に見舞われて', ...commons('8/8c', 'Down_on_his_luck_Frederick_McCubbin.jpg', false) },
    ],
  };
})();
