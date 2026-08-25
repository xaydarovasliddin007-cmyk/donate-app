-- Rename to reflect that this column now stores the FULL card number, not
-- a masked display value — the customer assigned a card needs the complete
-- number to actually key it into their own banking app for the transfer.
ALTER TABLE "receiving_methods" RENAME COLUMN "card_number_masked" TO "card_number";
