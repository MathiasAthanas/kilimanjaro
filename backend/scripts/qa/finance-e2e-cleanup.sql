begin;
-- payments recorded by the finance e2e (payer 'QA Payer') and everything hanging off them
delete from finance."ManualPaymentApproval" where "paymentId" in (select id from finance."Payment" where "payerName" = 'QA Payer');
update finance."Payment" set "receiptId" = null where "payerName" = 'QA Payer';
delete from finance."Receipt" where "paymentId" in (select id from finance."Payment" where "payerName" = 'QA Payer');
delete from finance."Payment" where "payerName" = 'QA Payer';
-- invoices for the synthetic term
delete from finance."InvoiceLineItem" where "invoiceId" in (select id from finance."Invoice" where "termId" like 'QA-TERM-%');
delete from finance."Invoice" where "termId" like 'QA-TERM-%';
delete from finance."FeeStructure" where "termId" like 'QA-TERM-%';
-- expenses, assets, store created by the run
delete from finance."Expense" where description = 'QA expense';
delete from finance."Asset" where name = 'QA Projector';
delete from finance."StoreMovement" where "storeItemId" in (select id from finance."StoreItem" where name = 'QA Chalk');
delete from finance."StoreItem" where name = 'QA Chalk';
commit;
