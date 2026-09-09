ALTER TABLE "massages"
ADD COLUMN "name" text;

UPDATE "massages" SET "name" = 'Ukojenie dla pleców i karku — Masaż klasyczny'
WHERE "id" = 'classic-back';

UPDATE "massages" SET "name" = 'Rozluźnienie po pracy siedzącej — Masaż pleców, karku i barków'
WHERE "id" = 'desk-relief';

UPDATE "massages" SET "name" = 'Masaż klasyczny całego ciała'
WHERE "id" = 'classic-body';

UPDATE "massages" SET "name" = 'Masaż indywidualny ORHEA — Praca z napięciem'
WHERE "id" = 'tension-relief';

UPDATE "massages" SET "name" = 'Praca z tkanką — Masaż bańką chińską'
WHERE "id" = 'cupping';

UPDATE "massages" SET "name" = 'Spokojne wyciszenie — Masaż relaksacyjny całego ciała'
WHERE "id" = 'relaxing-body';

UPDATE "massages" SET "name" = 'Regeneracja w cieple — Masaż ciepłymi kamieniami'
WHERE "id" = 'hot-stone';

UPDATE "massages" SET "name" = 'Czekoladowe odżywienie — Rytuał relaksacyjny'
WHERE "id" = 'chocolate-ritual';

UPDATE "massages" SET "name" = 'Rytuał miodowy — Masaż odżywczy i rozgrzewający'
WHERE "id" = 'honey-ritual';

UPDATE "massages" SET "name" = 'Rytuał głębokiej regeneracji ORHEA'
WHERE "id" = 'orhea-ritual';

UPDATE "massages" SET "name" = 'Lekkość ciała — Manualny drenaż limfatyczny'
WHERE "id" = 'lymphatic-body';

UPDATE "massages" SET "name" = 'Drenaż limfatyczny nóg'
WHERE "id" = 'lymphatic-legs';

UPDATE "massages" SET "name" = 'Lekkość twarzy — Drenaż limfatyczny twarzy'
WHERE "id" = 'lymphatic-face';

UPDATE "massages" SET "name" = 'Pielęgnacja i odprężenie — Masaż kosmetyczny twarzy'
WHERE "id" = 'cosmetic-face';

UPDATE "massages" SET "name" = 'Pobudzenie i odprężenie — Masaż liftingujący twarzy'
WHERE "id" = 'face-lifting';

UPDATE "massages" SET "name" = 'Masaż twarzy, szyi i dekoltu'
WHERE "id" = 'face-neck';

UPDATE "massages" SET "name" = 'Delikatne pobudzenie twarzy — Masaż bańką'
WHERE "id" = 'face-cupping';

UPDATE "massages" SET "name" = 'ORHEA VIP — Rytuał głębokiego ukojenia ciała i twarzy'
WHERE "id" = 'vip-ritual';

ALTER TABLE "massages"
ALTER COLUMN "name" SET NOT NULL;