import { Allowed } from '@/features/auth/Allowed';
import { ExpenseFormScreen } from '@/features/moneyout/ExpenseFormScreen';

export default function NewExpense() {
  return (
    <Allowed cap="addExpense">
      <ExpenseFormScreen />
    </Allowed>
  );
}
