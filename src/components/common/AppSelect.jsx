import { useRef } from 'react';
import { Select } from 'antd';

function AppSelect({
  ariaLabel,
  className,
  classNames,
  fullWidth = true,
  getPopupContainer,
  options,
  popupClassName,
  style,
  wrapperClassName,
  wrapperStyle,
  ...props
}) {
  const hostRef = useRef(null);
  const mergedClassNames = popupClassName
    ? {
        ...classNames,
        popup: {
          ...(classNames?.popup || {}),
          root: [classNames?.popup?.root, popupClassName].filter(Boolean).join(' '),
        },
      }
    : classNames;

  function resolvePopupContainer(triggerNode) {
    if (typeof getPopupContainer === 'function') {
      return getPopupContainer(triggerNode);
    }

    return hostRef.current || triggerNode?.parentElement || triggerNode?.ownerDocument?.body || document.body;
  }

  return (
    <div
      ref={hostRef}
      className={wrapperClassName}
      style={{
        position: 'relative',
        minWidth: 0,
        ...(fullWidth ? { width: '100%', flex: '1 1 auto' } : {}),
        ...wrapperStyle,
      }}
    >
      <Select
        aria-label={ariaLabel}
        className={className}
        classNames={mergedClassNames}
        options={options}
        style={{ ...(fullWidth ? { width: '100%' } : {}), ...style }}
        getPopupContainer={resolvePopupContainer}
        {...props}
      />
    </div>
  );
}

export default AppSelect;
