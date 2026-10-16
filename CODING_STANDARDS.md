# Coding standards

**Mock collaborators, not domain logic.** A mock that replaces project code with an identity function or trivial lambda is a finding — the composite it covered is untested. Mock at the outermost seam (network, DB, filesystem); keep the module's own logic real in its tests.
