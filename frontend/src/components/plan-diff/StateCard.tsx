function StateCard({
  title,
  message,
  helper,
  testId,
}: {
  title: string;
  message: string;
  helper: string;
  testId?: string;
}) {
  return (
    <div
      className="bg-white rounded-xl shadow p-6 border border-gray-100"
      data-testid={testId}
    >
      <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600 mb-2">{message}</p>
      <p className="text-sm text-gray-400">{helper}</p>
    </div>
  );
}

export default StateCard;
