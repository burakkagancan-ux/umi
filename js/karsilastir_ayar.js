/* İki ürünü karşılaştırma: ayarlar.
   Özelliği kapatmak için acik:false yapın; "Karşılaştır" düğmesi görünmez, tarama geçmişi tutulmaz. */
export var KARS_AYAR={
  acik:true,
  gecmisBoyut:20,        // telefonda tutulan son tarama sayısı
  taninmayanOran:0.3,    // içerik listesindeki parçaların bu oranından fazlası tanınmazsa kazanan ilan edilmez
  enAzParca:3            // oran yalnızca en az bu kadar parçalı listede uygulanır
};
