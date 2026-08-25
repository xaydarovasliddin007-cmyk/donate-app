-- Reservations no longer lock one exclusive card up front — the user is
-- shown every active receiving card and can transfer to any of them,
-- disambiguated by a globally-unique pending amount instead. The card is
-- only known once a matching transaction (or manual admin review)
-- identifies it.
ALTER TABLE "top_up_requests" ALTER COLUMN "receiving_method_id" DROP NOT NULL;
