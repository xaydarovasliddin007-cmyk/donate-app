-- CreateIndex
CREATE INDEX "top_up_requests_status_amount_minor_idx" ON "top_up_requests"("status", "amount_minor");
