import type { FamilyNode, FamilyGraph, Edge, MemberNode } from "@/types/family";

/**
 * VisibilityGate determines which nodes a given viewer (current user) is
 * allowed to see based on each node's `visibility` and `riskLevel` fields.
 *
 * Rules:
 * - "family"      → visible to everyone in the family.
 * - "guarded"     → visible only to the node's owner and parents.
 *                    Caregivers CANNOT see guarded nodes (e.g. financial docs).
 * - "private"     → visible only to the node's owner.
 *   EXCEPT: parents can see "private" nodes that have riskLevel "high"
 *           (safety override — e.g. Dad can see Daughter's Suspicious App).
 * - "health_only" → visible to the node's owner, parents, grandparents,
 *                    and caregivers (secondary admins with health access).
 *                    NOT visible to children or siblings.
 * - Achievements (isAchievement: true) are ALWAYS visible to everyone,
 *   regardless of visibility setting, to encourage positive interaction.
 */

/** Find the owner of a non-member node by walking edges */
function findOwner(nodeId: string, edges: Edge[]): string | null {
  for (const edge of edges) {
    // Edges where a member points to this node
    if (edge.target === nodeId && edge.source.startsWith("m-")) {
      return edge.source;
    }
    if (edge.source === nodeId && edge.target.startsWith("m-")) {
      return edge.target;
    }
  }
  return null;
}

/** Check if viewerId is a parent of ownerId by looking at edges */
function isParentOf(viewerId: string, ownerId: string, edges: Edge[]): boolean {
  return edges.some(
    (e) =>
      e.relation === "parent_of" &&
      e.source === viewerId &&
      e.target === ownerId,
  );
}

/** Check if viewerId is a grandparent of ownerId */
function isGrandparentOf(viewerId: string, ownerId: string, edges: Edge[]): boolean {
  return edges.some(
    (e) =>
      e.relation === "grandparent_of" &&
      e.source === viewerId &&
      e.target === ownerId,
  );
}

/** Check if viewerId is a caregiver of ownerId */
function isCaregiverOf(viewerId: string, ownerId: string, edges: Edge[]): boolean {
  return edges.some(
    (e) =>
      e.relation === "caregiver_of" &&
      e.source === viewerId &&
      e.target === ownerId,
  );
}

/** Check if a document node is a financial document */
function isFinancialDoc(node: FamilyNode): boolean {
  return node.type === "document" && "docType" in node && node.docType === "financial";
}

export function applyVisibilityGate(
  graph: FamilyGraph,
  viewerId: string,
): FamilyGraph {
  const viewerNode = graph.nodes.find((n) => n.id === viewerId) as MemberNode | undefined;
  const viewerRole = viewerNode?.role;

  const visibleNodes = graph.nodes.filter((node) => {
    // Achievements are always visible
    if (node.isAchievement) return true;

    // Member nodes are always visible
    if (node.type === "member") return true;

    const visibility = node.visibility ?? "family";

    // Family-visible nodes are open to all
    if (visibility === "family") return true;

    const ownerId = findOwner(node.id, graph.edges);

    // If the viewer owns this node, they can always see it
    if (ownerId === viewerId) return true;

    // ── health_only: parents, grandparents, and caregivers can see ──
    if (visibility === "health_only") {
      if (!ownerId) return false;
      // Parents can see
      if (isParentOf(viewerId, ownerId, graph.edges)) return true;
      // Grandparents can see
      if (isGrandparentOf(viewerId, ownerId, graph.edges)) return true;
      // Caregiver can see health data of the person they care for
      if (isCaregiverOf(viewerId, ownerId, graph.edges)) return true;
      // Also allow if the health node is directly connected to someone the caregiver cares for
      if (viewerRole === "caregiver") {
        // Check if the health node belongs to anyone the caregiver is assigned to
        const careTargets = graph.edges
          .filter((e) => e.relation === "caregiver_of" && e.source === viewerId)
          .map((e) => e.target);
        if (careTargets.includes(ownerId)) return true;
      }
      return false;
    }

    if (visibility === "guarded") {
      // Caregivers cannot see guarded nodes (financial data, etc.)
      if (viewerRole === "caregiver") return false;
      // Guarded: owner + parents + grandparents of the owner
      if (ownerId && isParentOf(viewerId, ownerId, graph.edges)) return true;
      if (ownerId && isGrandparentOf(viewerId, ownerId, graph.edges)) return true;
      // Safety override: high-risk guarded nodes are visible to children of the owner
      // (e.g. Dad can see Grandma's risky 15% Gold Fund)
      if (node.riskLevel === "high" && ownerId && isParentOf(ownerId, viewerId, graph.edges)) return true;
      return false;
    }

    if (visibility === "private") {
      // Private: only the owner — UNLESS it's high risk and viewer is a parent
      if (
        node.riskLevel === "high" &&
        ownerId &&
        isParentOf(viewerId, ownerId, graph.edges)
      ) {
        return true;
      }
      return false;
    }

    return true;
  });

  // Additional filter: caregivers cannot see financial documents even if they pass visibility
  const filteredNodes = visibleNodes.filter((node) => {
    if (viewerRole === "caregiver" && isFinancialDoc(node)) return false;
    return true;
  });

  const visibleIds = new Set(filteredNodes.map((n) => n.id));
  const visibleEdges = graph.edges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
  );

  return { nodes: filteredNodes, edges: visibleEdges };
}
