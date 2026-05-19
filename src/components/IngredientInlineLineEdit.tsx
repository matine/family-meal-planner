import { InlineEditableText } from "@/components/InlineEditableText";

type Props = {
  value: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  onCommit: (line: string) => void;
};

const EMPTY_PLACEHOLDER = "Ingredient with quantity eg. 2 cloves of garlic";

/** Single-line ingredient text with click-to-edit. */
export function IngredientInlineLineEdit(props: Props) {
  return (
    <InlineEditableText
      wrap
      emptyPlaceholder={EMPTY_PLACEHOLDER}
      inputClassName="!bg-white"
      ariaLabel={props.ariaLabel ?? "Recipe ingredient line"}
      {...props}
    />
  );
}
