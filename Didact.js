const UPDATE = /*        */ Symbol('UPDATE');
const PLACEMENT = /*     */ Symbol('PLACEMENT');
const DELETION = /*      */ Symbol('DELETION');

const TEXT_ELEMENT = /*  */ Symbol('TEXT_ELEMENT');

function createTextElement(text) {
  return {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child => (
        typeof child === 'object'
          ? child
          : createTextElement(child)
      )),
    },
  }
}

const isEvent = key => key.startsWith('on');/*                                     */// 是否是一个绑定事件。依据：是否以 “on” 开头。
const isStyle = key => key === 'style';/*                                          */// 是否是一个 Style Attribute。
const isProperty = key => key !== 'children' && !isEvent(key) && !isStyle(key);/*  */// 是否是一个 DOM Attribute。依据：不包含 `children` 以及绑定事件。
const isNew = (prev, next) => key => prev[key] !== next[key];/*                    */// 是否是一个新的 DOM Attribute。依据：历史属性与新属性不相同。
const isGone = (prev, next) => key => !(key in next);/*                            */// 是否是一个遗弃的 DOM Attribute。依据：将历史属性的 key 在新的 props 里遍历，查询是否存在

function createDom(fiber) {
  const dom = fiber.type === TEXT_ELEMENT
    ? document.createTextNode('')
    : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);

  return dom;
}

function updateDom(dom, prevProps, nextProps) {
  // 移除旧的或已变化的事件监听
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // 添加新的事件监听
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });

  const prevStyle = prevProps.style || {};
  const nextStyle = nextProps.style || {};

  // 移除旧的 Style Attribute
  Object.keys(prevStyle)
    .filter(isGone(prevStyle, nextStyle))
    .forEach(name => dom.style[name] = '');

  // 设置新的或已变化的 Style Attribute
  Object.keys(nextStyle)
    .filter(isNew(prevStyle, nextStyle))
    .forEach(name => dom.style[name] = nextStyle[name]);

  // 移除旧的 DOM Attribute
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom.removeAttribute(name);
    });

  // 设置新的或已变化的 DOM Attribute
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name];
    });
}

function commitRoot() {
  deletions.forEach(commitWork);/* */// 删除记录的 Fiber 节点
  commitWork(wipRoot.child);/*     */// 提交 wipRoot
  currentRoot = wipRoot;/*         */// 记录 wipRoot 到 currentRoot
  wipRoot = null;/*                */// 清空 wipRoot
}

function commitWork(fiber) {
  if (!fiber) {
    return;
  }

  // FunctionComponent 与 HostComponent 数据结构有所不同
  //
  // HostComponent:
  // 在 updateHostComponent 中，`fiber.dom = createDom(fiber);` 语句保证了每个 fiber 节点都存在 dom 属性
  // 因此 domParent 永远有值，往后的 DOM 增删操作，都会由 domParent.appendChild 或 domParent.removeChild 来执行，所以保证 domParent 节点存在，是非常必要的
  //
  // FunctionComponent:
  // 与 HostComponent 不同的是，FunctionComponent 首次进入 performUnitOfWork function 时，其 type 是一个函数，
  // 这就决定了 FunctionComponent 的第一个 Fiber 节点，是不存在 dom 属性的（除非在 updateFunctionComponent 中造一个 <div> 包裹），
  // 如果不做处理，当遍历到 FunctionComponent 下一个子节点时，就会出现 domParent = null，导致操作 dom 节点失败；
  // 这里使用 `while (!domParentFiber.dom)` 的目的，就是为了将 FunctionComponent 的根节点，赋值到 #root 上。
  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }

  const domParent = domParentFiber.dom;

  if (
    fiber.effectTag === PLACEMENT &&
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom);
  } else if (
    fiber.effectTag === UPDATE &&
    fiber.dom != null
  ) {
    updateDom(fiber.dom, fiber.alertnate.props, fiber.props);
  } else if (fiber.effectTag === DELETION) {
    commitDeletion(fiber, domParent);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function commitDeletion(fiber, domParent) {
  // 当删除 FunctionComponent 根节点时，fiber.dom 是不存在的
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alertnate: currentRoot,
  }
  deletions = [];
  nextUnitOfWork = wipRoot;
}

let nextUnitOfWork = /* */ null; // 供下一个工作单元使用的 Fiber 节点(performUnitOfWork 调用)
let currentRoot = /*    */ null; // 目前已提交渲染的 Fiber 节点，全量
let wipRoot = /*        */ null; // wip = work in progress 目前正在工作区使用的 Fiber 节点，全量
let deletions = /*      */ null; // 需要删除的 Fiber 节点

/**
 * 当浏览器有空闲时间时，会执行该方法
 */
function workLoop(deedline) {
  let shouldYield = false;

  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deedline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  // 1 判断是 FunctionComponent(函数组件) 还是 HostComponent(原生组件)
  //   FunctionComponent 会在第一次遍历，进入 updateFunctionComponent function 逻辑，
  //   其往后的遍历都会进入 updateHostComponent function 中。
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  // 2 当以上循环完成后，就将 fiber.child 返回，workLoop 方法会执行 `nextUnitOfWork = performUnitOfWork(nextUnitOfWork)`，
  //   这就进入了下一轮循环。
  if (fiber.child) {
    return fiber.child;
  }

  // 3 如果已经走到了末级节点，即 fiber.child 为空，则从当前 fiber 节点向上查找(nextFiber = nextFiber.parent)，
  //   每向上一级，查询该级节点是否有 sibling 节点，有则 return，进入该节点遍历，没有则一直向上，直到 nextFiber.parent 为 null，结束遍历
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }

    nextFiber = nextFiber.parent;
  }
}

let wipFiber = null;/*   */// 供 hooks 使用的 work in progress fiber
let hookIndex = null;/*  */// 当存在多个 hooks 调用时，用来记录下标遍历

function updateFunctionComponent(fiber) {
  // 初始化 hooks 需要的信息
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  // 执行函数，得到响应的 elements
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

// TODO: function useEffect(effect, deps) {...}

function useState(initial) {
  const oldHook =
    wipFiber.alertnate &&
    wipFiber.alertnate.hooks &&
    wipFiber.alertnate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(action => {
    typeof action === 'function'
      ? hook.state = action(hook.state)
      : hook.state = action;
  });

  // setState 做了两件事情：
  // a. 将 action 存入 hook.queue 中
  // b. 重设 wipRoot nextUnitOfWork deletions 对象，这里就类似调用了 render function，
  //    因为调用了 render function，并且 nextUnitOfWork 的值也与 currentRoot 保持一致，
  //    此时就会再次调用 updateFunctionComponent function，并调用 useState function，并通过 oldHook.queue 调用 a 步骤存储的 action。
  const setState = action => {
    /**
     * wipFiber，是 FunctionComponent 在 PLACEMENT 阶段，最终输出的 Fiber。
     * wipFiber 在 FunctionComponenent PLACEMENT 结束后，并没有被销毁，
     * 所以，wipFiber.hooks === currentRoot.child.hooks 为 true，
     * 即，currentRoot.child.hooks[0] === hook 为 true，
     * 所以这里 hook.queue.push(action) 会直接改变 wipFiber 以及 currentRoot
     *
     * @example 数组指针
     * const hooks = [];
     * const hook = { state: 'test', queue: [] }
     * hooks.push(hook)
     * hook.queue.push(1)
     * console.log(hooks)
     * -> [
     *      {
     *        state: 'test',
     *        queue: [1],
     *      },
     *    ]
     *
     * wipRoot.alertnate = currentRoot，这里将 wipRoot 与 currentRoot 连接，
     * 当完成 setState 后，Didact 会立即进行 render，并重新执行 updateFunctionComponent -> fiber.type(fiber.props) -> useState，
     * 当 UPDATE 阶段执行 useState 时，我们就可以从 wipFiber.alertnate.hooks 中取出 queue，并执行 action。
     */
    hook.queue.push(action);

    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alertnate: currentRoot,
    }

    nextUnitOfWork = wipRoot;
    deletions = [];
  }

  /**
   * 为函数组件挂载 hooks 属性，「应用层」调用 setState 后，会将 action 注入到 hooks 里，
   * useState 将在下一次迭代，调用这些 actions。
   */
  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

function updateHostComponent(fiber) {
  // 1 如果传入 fiber.dom 为空，则创建并挂载
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 2 遍历 fiber 节点下的所有 children，并创建新的 fiber 节点
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
}

function reconcileChildren(wipFiber, elements) {
  let index = 0;

  // 1 当调用 render 方法时，会执行 wipRoot.alertnate = currentRoot，首次渲染，该值为 null；
  //   当为 newFiber 打上 UPDATE 标记时，会将 oldFiber 赋值给 newFiber.alertnate，该值同样会在后续 commit phase updateDom 时用到，作为判断条件来执行 DOM 的属性赋值操作；
  //   当完成 commitRoot 方法时，会执行 currentRoot = wipRoot；
  //   当页面再次更新，第二次调用 render 方法时，wipRoot.alertnate 被赋值，就可作为 oldFiber，为之后的 Fiber 节点创建提供复用数据
  let oldFiber = wipFiber.alertnate && wipFiber.alertnate.child;
  let prevSibling = null;

  // 2 遍历 elements，并直到 wipFiber.alertnate 没有历史数据为止（即 oldFiber）；
  //   遍历 oldFiber 的目的，是为了找到本次更新被删除的节点。
  while (index < elements.length || oldFiber != null) {
    const element = elements[index];

    let newFiber = null;

    // 3 当 oldFiber element 都存在，并且 element.type == oldFiber.type 时
    //   说明前后是一个相同节点，要么该节点有更新，要么保持不变
    const sameType =
      oldFiber &&
      element &&
      element.type == oldFiber.type;

    // 4.1 update the node
    //     当 sameType 条件成立时，
    //     `type dom alertnate` 三个字段复用 `oldFiber` 中的值，
    //     `props` 使用新传入的值，
    //     并打上标记 `newFiber.effectTag = UPDATE`，该值在后续 commit phase updateDom 阶段，指导 `updateDom function` 如何更新 DOM。
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alertnate: oldFiber,
        effectTag: UPDATE,
      }
    }

    if (element && !sameType) {
      // 4.2 add this node
      //     `element && !sameType` 表示该节点是一个全新的元素，为 newFiber 赋值基础属性后，打上标记 `newFiber.effectTag = PLACEMENT`；
      //     `commit` 阶段会识别这个标记，`append` 一个全新的 DOM 元素。
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alertnate: null,
        effectTag: PLACEMENT,
      }
    }

    if (oldFiber && !sameType) {
      // 4.3 delete the oldFiber's node
      //     `oldFiber && !sameType` 条件，意味着上一次循环时存在 `oldFiber` 这个元素，但这一次却没有，这说明该元素被删除了；
      //     我们将 `oldFiber.effectTag = DELETION` 打上删除标记，并放置在变量 `deletions` 中（deletions 在 render function 中会被设置为空数组）,
      //     `commit` 阶段会识别这个标记，并执行 `removeChild` 操作删除 DOM 元素。
      oldFiber.effectTag = DELETION;
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    // 5 下标为 0 的元素直接赋值给 unit of work 中的 wipFiber.child
    //   下标非 0 的元素，丢给 wipFiber.child.sibling，并逐层嵌套
    //
    //   特别注意这里的 `prevSibling.sibling = newFiber` 和 `prevSibling = newFiber`
    //   当 index === 0 时，会执行 `prevSibling = newFiber`，因为 newFiber 指针指向 wipFiber.child，所以这里实际将 prevSibling 的指针指向了 wipFiber.child；
    //   当 index === 1 时，会执行 `prevSibling.sibling = newFiber`，此时的 prevSibling 其实指向的上一个 wipFiber.child，所以这里是对上一个 wipFiber.child.sibling 直接赋值，值就是当前的 newFiber；
    //   `prevSibling.sibling = newFiber` 执行完毕后，再执行 `prevSibling = newFiber`，以此往复。
    if (index === 0) {
      wipFiber.child = newFiber;
    } else {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;

    index++;
  }
}

const Didact = { createElement, render, useState };
