import { FileStockForm } from "../components/FileStockForm";
import { StockLookup } from "../components/StockLookup";

export function FileStockPage() {
  return (
    <main className="page page--narrow">
      <header className="page__header">
        <h1 className="page__title">File stock</h1>
      </header>
      <FileStockForm />
      <StockLookup />
    </main>
  );
}
